---
title: "C와 libpcap으로 패킷 캡처 프로그램 만들기"
date: 2026-11-12 00:00:00 +0900
category_slug: development
thumbnail: ""
description: "C와 libpcap으로 실시간 패킷 캡처 프로그램을 구현했다. raw packet에서 Ethernet·IPv4·TCP 헤더와 Payload의 위치를 계산하며 패킷 구조를 이해한 기록."
tags: ["C", "libpcap", "Network", "Packet Capture", "TCP/IP"]
sample: false
---

네트워크를 공부하면서 Wireshark로 패킷을 확인하는 일은 자주 있었지만, 실제 프로그램에서는 **패킷을 어떻게 받아오고 각 헤더를 어떻게 구분하는지** 궁금했다.

그래서 C와 `libpcap`을 이용해 간단한 패킷 캡처 프로그램을 직접 만들어 보았다. 이번 활동의 목표는 **raw packet을 직접 읽으면서 Ethernet → IPv4 → TCP → Payload로 이어지는 구조를 이해하는 것**이었다.

| 항목 | 내용 |
| :--- | :--- |
| **사용 언어·라이브러리** | C · `libpcap` |
| **입력** | 패킷을 수집할 네트워크 인터페이스 |
| **분석 대상** | Ethernet → IPv4 → TCP |
| **출력** | 출발지·목적지 MAC, IP, 포트와 헤더 이후 데이터 최대 20바이트 |
| **GitHub** | [cprtmchzh/packet-capture-tool](https://github.com/cprtmchzh/packet-capture-tool) |

---

## 01. libpcap으로 패킷 받아오기

### 인터페이스를 열고 패킷 수신하기

프로그램을 실행할 때 패킷을 수집할 네트워크 인터페이스를 인자로 입력받도록 했다.

```text
pcap-test <interface>
```

프로그램에서는 `pcap_open_live()`로 해당 인터페이스를 열고, `pcap_next_ex()`를 반복 호출하면서 패킷을 하나씩 받아온다.

```text
네트워크 인터페이스
        ↓
libpcap으로 패킷 수신
        ↓
Raw Packet과 캡처 메타데이터
        ↓
헤더 위치 계산 및 정보 출력
```

| 함수 | 코드에서의 역할 |
| :--- | :--- |
| `pcap_open_live()` | 지정한 인터페이스의 실시간 캡처 핸들 생성 |
| `pcap_next_ex()` | 다음 패킷의 메타데이터와 바이트 데이터 수신 |
| `pcap_close()` | 캡처 핸들 정리 |

반복문에서는 타임아웃이면 다음 패킷을 기다리고, 오류나 캡처 종료가 반환되면 루프를 빠져나오도록 했다.

처음에는 패킷 캡처 자체가 복잡할 것이라고 생각했다. 하지만 인터페이스에서 패킷을 가져오는 부분은 libpcap이 처리해 주었고, 실제로 고민할 부분은 **받아온 바이트 데이터를 어떻게 해석할 것인가**였다.

## 02. Ethernet 헤더부터 직접 읽어보기

이번 프로그램은 **VLAN 태그가 없는 14바이트 Ethernet 헤더**를 전제로 패킷을 읽는다. 패킷 시작 부분을 직접 정의한 Ethernet 헤더 구조체로 해석하고, 출발지·목적지 MAC과 EtherType을 확인했다.

```text
Ethernet Header · 14 bytes
├─ Destination MAC · 6 bytes
├─ Source MAC      · 6 bytes
└─ EtherType       · 2 bytes
```

| 필드 | 시작 위치 | 길이 | 용도 |
| :--- | ---: | ---: | :--- |
| Destination MAC | 0 | 6바이트 | 목적지 MAC 주소 |
| Source MAC | 6 | 6바이트 | 출발지 MAC 주소 |
| EtherType | 12 | 2바이트 | 다음 계층의 프로토콜 구분 |

위치는 패킷 시작을 기준으로 한 바이트 오프셋이다. 코드에서는 EtherType의 두 바이트를 조합하고, 값이 `0x0800`인 **IPv4 패킷만 다음 단계로 넘겼다.**

```c
uint16_t ether_type = eth->ether_type[0] << 8 | eth->ether_type[1];

if (ether_type != 0x0800)
    return;
```

이 과정에서 Wireshark의 `Ethernet II` 정보도 결국 패킷 앞부분의 바이트를 정해진 구조에 맞춰 읽고 해석한 결과라는 것을 확인할 수 있었다.

> **캡처 형식의 전제:** libpcap이 반환하는 데이터의 링크 계층 형식은 인터페이스에 따라 달라질 수 있다. 현재 코드는 Ethernet을 가정하며, 다른 캡처 형식까지 처리하려면 `pcap_datalink()`로 형식을 확인하는 과정이 필요하다. [libpcap 공식 문서](https://www.tcpdump.org/manpages/pcap_datalink.3pcap.html)

## 03. IPv4 헤더에서 다음 위치 찾기

### IHL로 헤더 길이 계산하기

이 프로그램에서 IPv4 헤더는 Ethernet 헤더 14바이트 뒤에서 시작한다.

```c
const uint8_t *ip = packet + ETH_HDR_LEN;
uint8_t ip_hl = (ip[0] & 0x0F) * 4;
```

여기서 신경 써야 했던 부분은 **IPv4 헤더 길이가 항상 20바이트로 고정되어 있지는 않다는 것**이었다.

첫 번째 바이트의 하위 4비트인 **IHL(Internet Header Length)**은 헤더 길이를 32비트, 즉 4바이트 단위로 나타낸다. 따라서 하위 4비트를 읽은 뒤 `4`를 곱하면 바이트 단위의 헤더 길이를 구할 수 있다. [RFC 791](https://www.rfc-editor.org/rfc/rfc791)

| IHL 값 | 계산 | IPv4 헤더 길이 |
| ---: | :--- | ---: |
| `5` | `5 × 4` | 20바이트 |
| `6` | `6 × 4` | 24바이트 |

위 표는 길이 계산 예시다. 단순히 IPv4 헤더를 항상 20바이트로 취급하면, 옵션이 포함된 패킷에서 다음 헤더의 위치를 잘못 계산할 수 있다.

### 주소와 상위 프로토콜 확인하기

IPv4 헤더에서는 다음 정보를 읽었다.

| 필드 | IPv4 헤더 내 위치 | 처리 |
| :--- | :--- | :--- |
| Protocol | 바이트 오프셋 `9` | 값이 `6`인 TCP만 다음 단계로 전달 |
| Source IP | 바이트 오프셋 `12~15` | 출발지 IPv4 주소 출력 |
| Destination IP | 바이트 오프셋 `16~19` | 목적지 IPv4 주소 출력 |

직접 위치를 계산해 보면서 헤더 내부에 길이와 프로토콜 정보가 존재하는 이유를 더 명확하게 이해할 수 있었다. **현재 계층의 헤더가 다음 계층의 위치와 종류를 알려주는 구조**였다.

## 04. TCP 헤더와 Payload 확인하기

### Data Offset으로 TCP 헤더 길이 계산하기

IPv4의 Protocol 값이 `6`이면 TCP 분석 단계로 넘어간다. TCP 헤더의 시작 위치는 다음과 같이 구했다.

```text
TCP 헤더 시작 위치 = 패킷 시작 + 14 + IPv4 헤더 길이
```

TCP도 헤더 길이가 가변적이다. **Data Offset**은 TCP 헤더 길이를 4바이트 단위로 나타내므로, 해당 값을 읽고 `4`를 곱해 실제 길이를 계산한다. [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293)

현재 코드의 TCP 구조체에서는 `th_hl` 배열이 TCP 헤더의 바이트 오프셋 `4`부터 시작한다. 따라서 `th_hl[8]`은 TCP 헤더 기준 오프셋 `12`에 해당하며, 그 바이트의 상위 4비트를 읽는다.

```c
uint8_t tcp_hl = (tcp->th_hl[8] >> 4) * 4;
```

계산한 길이는 다음 데이터의 위치를 찾는 데 사용하고, 화면에는 **Source Port와 Destination Port**를 출력했다.

### 헤더 뒤의 데이터 출력하기

Ethernet·IPv4·TCP 헤더 길이를 모두 더하면 TCP 헤더 바로 다음 위치를 구할 수 있다.

```c
const uint8_t *payload = packet + ETH_HDR_LEN + ip_hl + tcp_hl;
```

```text
Raw Packet
├─ Ethernet Header · 14 bytes
├─ IPv4 Header     · IHL × 4 bytes
├─ TCP Header      · Data Offset × 4 bytes
└─ Payload
```

출력은 데이터가 길어도 **앞부분 최대 20바이트까지만 16진수로 표시**하도록 만들었다. 현재 구현은 `header->caplen`과 계산한 시작 위치를 비교해, 캡처된 데이터가 남아 있으면 출력하고 그렇지 않으면 `No Data`를 표시한다.

TCP 세그먼트에는 데이터가 없을 수도 있다. 연결 설정이나 확인 응답에 사용되는 세그먼트를 살펴보면서, 헤더가 존재한다고 항상 애플리케이션 데이터까지 포함되는 것은 아니라는 점을 코드와 연결해 이해할 수 있었다.

## 05. 바이트 오프셋으로 연결해 본 패킷 구조

이번 활동에서 가장 도움이 되었던 부분은 **여러 헤더가 순서대로 붙어 있다는 설명을 실제 메모리 위치와 연결해 본 것**이었다.

| 구간 | 패킷 시작 기준 오프셋 | 길이를 구하는 기준 |
| :--- | :--- | :--- |
| Ethernet 헤더 | `0` | 현재 구현은 14바이트 가정 |
| IPv4 헤더 | `14` | `IHL × 4` |
| TCP 헤더 | `14 + ip_hl` | `Data Offset × 4` |
| Payload | `14 + ip_hl + tcp_hl` | 앞선 헤더 길이의 합으로 시작 위치 계산 |

예를 들어 IPv4와 TCP 헤더가 각각 20바이트인 경우, Payload 시작 위치는 다음과 같다.

```text
0                  14                 34                 54
│ Ethernet Header  │ IPv4 Header      │ TCP Header       │ Payload
└─ 14 bytes ───────┴─ 20 bytes ───────┴─ 20 bytes ───────┘

Payload 시작 오프셋 = 14 + 20 + 20 = 54
```

이 숫자는 옵션이 없는 경우의 계산 예시이며, 실제 코드에서는 IPv4와 TCP 헤더에서 읽은 길이를 사용한다.

libpcap에서 받은 패킷은 처음부터 MAC 주소, IP 주소, 포트 번호로 정리된 객체가 아니다. 프로그램이 **바이트 배열에서 각 필드의 위치를 계산하고 의미를 붙여야 한다.**

평소 Wireshark에서 자연스럽게 보던 출발지·목적지 정보도 이러한 해석 과정을 거쳐 표시된다는 점을 이해하는 데 도움이 됐다. 프로토콜 이름을 외우는 것과 함께, 각 헤더가 다음 계층을 어떻게 가리키는지 살펴보는 것이 중요하다고 느꼈다.

## 06. 구현 범위와 확장할 부분

### 현재 구현 범위

이번 프로그램은 패킷 구조를 공부하기 위한 간단한 실습이다. 지원하는 범위는 다음과 같다.

| 항목 | 현재 구현 |
| :--- | :--- |
| **패킷 수집** | 지정한 인터페이스에서 실시간 캡처 |
| **분석 대상** | 14바이트 Ethernet → IPv4 → TCP |
| **주소·포트 출력** | 출발지·목적지 MAC, IPv4 주소, TCP 포트 |
| **데이터 출력** | 계산한 TCP 헤더 이후의 캡처 데이터 최대 20바이트 |
| **다른 프로토콜** | UDP·ARP·IPv6 별도 처리 없음 |
| **파일 저장** | `.pcap` 저장 기능 없음 |

현재 코드는 헤더를 읽기 전의 길이 검증이나 IPv4 조각 재조립까지 구현한 상태는 아니다. 또한 데이터 길이를 IP Total Length 대신 캡처 길이인 `caplen`으로 계산하므로, Ethernet 패딩 등이 TCP Payload와 함께 출력될 수 있다. 다양한 패킷을 정확히 처리하려면 이 경계들을 보완해야 한다.

### 이후 확장해 보고 싶은 기능

- **파싱 보완:** 캡처 형식 확인, 헤더 길이 검증, IP 길이를 반영한 Payload 범위 계산
- **프로토콜 확장:** UDP·ARP·IPv6 헤더 분석
- **캡처 필터:** BPF를 이용한 수집 대상 제한
- **파일 입출력:** `.pcap` 저장과 저장된 패킷 분석
- **상위 계층 분석:** HTTP 등 애플리케이션 프로토콜 해석
- **통계 기능:** 패킷 수·프로토콜 분포 집계와 간단한 이상 트래픽 탐지

규모가 큰 프로그램은 아니지만, **패킷을 직접 받아서 헤더를 구분하고 다음 데이터의 위치를 계산해 본 경험**이라는 점에서 의미가 있었다. 이후 네트워크 보안 프로젝트를 진행할 때도 이 바이트 단위의 구조를 떠올리며 통신을 분석해 보고 싶다.

---

## 참고 자료

- [GitHub · packet-capture-tool](https://github.com/cprtmchzh/packet-capture-tool)
- [구현 코드 · pcap-test.c](https://github.com/cprtmchzh/packet-capture-tool/blob/main/pcap-test.c)
- [libpcap · pcap_datalink()](https://www.tcpdump.org/manpages/pcap_datalink.3pcap.html)
- [RFC 791 · Internet Protocol](https://www.rfc-editor.org/rfc/rfc791)
- [RFC 9293 · Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293)

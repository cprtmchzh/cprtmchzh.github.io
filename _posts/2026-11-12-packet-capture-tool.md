---
title: "네트워크 패킷 캡처 프로그램 구현"
date: 2026-05-17 00:00:00 +0900
category_slug: development
thumbnail: ""
description: "네트워크 패킷 구조 분석 및 C와 PCAP을 이용한 실시간 패킷 캡처 프로그램 구현."
tags: ["C", "Network", "PCAP", "TCP/IP"]
sample: false
---

Wireshark 같은 분석 도구가 네트워크 인터페이스에서 패킷을 어떻게 수신하고 각 계층의 헤더를 어떻게 구분하는지 확인하기 위해, C와 `libpcap`을 이용해 패킷 캡처 프로그램을 직접 구현했다.

이번 구현의 목표는 **수신한 raw 패킷의 바이트 스트림을 직접 파싱하며 Ethernet → IPv4 → TCP → Payload로 이어지는 계층 구조와 오프셋 계산 방식 확인**이다.

| 항목 | 내용 |
| :--- | :--- |
| **사용 언어·라이브러리** | C · `libpcap` |
| **입력** | 패킷을 수집할 네트워크 인터페이스 |
| **분석 대상** | Ethernet → IPv4 → TCP |
| **출력** | 출발지·목적지 MAC, IP, 포트 및 헤더 이후 데이터 최대 20바이트 |
| **GitHub** | [cprtmchzh/packet-capture-tool](https://github.com/cprtmchzh/packet-capture-tool) |

---

## 01. libpcap을 이용한 패킷 수신

프로그램 실행 시 패킷을 수집할 네트워크 인터페이스 이름을 인자로 입력받는다.

```text
pcap-test <interface>
```

내부적으로는 `pcap_open_live()`를 호출해 해당 인터페이스의 캡처 핸들을 열고, 반복문에서 `pcap_next_ex()`를 호출해 패킷을 순차적으로 읽어온다.

| 함수 | 코드에서의 역할 |
| :--- | :--- |
| `pcap_open_live()` | 지정한 인터페이스의 실시간 캡처 핸들 생성 |
| `pcap_next_ex()` | 다음 패킷의 메타데이터와 바이트 배열 수신 |
| `pcap_close()` | 캡처 핸들 해제 |

반복문에서는 읽기 타임아웃이 발생하면 다음 패킷을 대기하고, 오류나 종료 상태가 반환되면 루프를 종료하도록 구성했다. 인터페이스에서 패킷을 수집하는 과정 자체는 `libpcap`이 처리하므로, 실제 구현의 핵심은 **수신한 바이트 배열을 각 프로토콜 규격에 맞게 해석하는 것**이다.

## 02. Ethernet 헤더 파싱

본 프로그램은 **VLAN 태그가 없는 14바이트 표준 Ethernet 헤더**를 전제로 패킷을 해석한다. 패킷의 시작 주소를 Ethernet 헤더 구조체 포인터로 캐스팅해 출발지·목적지 MAC 주소와 EtherType 필드를 읽는다.

```text
Ethernet Header · 14 bytes
├─ Destination MAC · 6 bytes   # 0 offset, 목적지 MAC 주소
├─ Source MAC      · 6 bytes   # 6 offset, 출발지 MAC 주소
└─ EtherType       · 2 bytes   # 12 offset, 상위 계층 프로토콜 식별
```

오프셋은 패킷 시작 위치를 기준으로 한 바이트 단위다. 코드에서는 EtherType의 두 바이트를 빅 엔디안(Big-endian) 기준으로 조합한 뒤, 값이 `0x0800`(IPv4)인 패킷만 다음 단계로 전달한다.

```c
uint16_t ether_type = eth->ether_type[0] << 8 | eth->ether_type[1];

if (ether_type != 0x0800)
    return;
```

> **캡처 형식의 전제:** `libpcap`이 반환하는 링크 계층 헤더 형식은 네트워크 인터페이스 종류에 따라 달라질 수 있다. 현재 코드는 Ethernet(`DLT_EN10MB`) 환경을 가정하며, 다른 링크 계층 형식까지 지원하려면 `pcap_datalink()`로 데이터링크 타입을 먼저 확인해야 한다. ([libpcap 공식 문서](https://www.tcpdump.org/manpages/pcap_datalink.3pcap.html))

## 03. IPv4 헤더 파싱 및 오프셋 계산

### IHL을 이용한 가변 헤더 길이 계산

IPv4 헤더는 Ethernet 헤더(14바이트) 바로 뒤에서 시작한다.

```c
const uint8_t *ip = packet + ETH_HDR_LEN;
uint8_t ip_hl = (ip[0] & 0x0F) * 4;
```

여기서 주의할 점은 **IPv4 헤더 길이가 항상 20바이트로 고정되어 있지 않다는 것**이다.

IPv4 헤더의 첫 번째 바이트 하위 4비트인 **IHL(Internet Header Length)**은 헤더 길이를 32비트(4바이트) 워드 단위로 나타낸다. 따라서 하위 4비트 값을 마스킹해 추출한 뒤 `4`를 곱해야 실제 바이트 단위 길이를 얻을 수 있다. 때문에 IPv4 헤더 길이를 20바이트 상수로 고정해 처리하면, IP 옵션이 포함된 패킷을 만났을 때 상위 계층(TCP) 헤더의 시작 위치를 잘못 참조하게 된다.

### IP 주소 및 상위 프로토콜 확인

IPv4 헤더에서 추출한 주요 필드는 다음과 같다.

| 필드 | IPv4 헤더 내 오프셋 | 처리 내용 |
| :--- | :--- | :--- |
| Protocol | 바이트 오프셋 `9` | 값이 `6`(TCP)인 패킷만 다음 단계로 전달 |
| Source IP | 바이트 오프셋 `12~15` | 출발지 IPv4 주소 출력 |
| Destination IP | 바이트 오프셋 `16~19` | 목적지 IPv4 주소 출력 |

각 계층의 헤더는 이처럼 **자신의 전체 길이와 다음 계층의 프로토콜 종류를 명시**하여, 파서가 연속된 바이트 스트림에서 다음 헤더를 찾아갈 수 있도록 설계되어 있다.

## 04. TCP 헤더 및 Payload 추출

### Data Offset을 이용한 TCP 헤더 길이 계산

IPv4의 Protocol 필드 값이 `6`이면 TCP 헤더 파싱으로 넘어간다. TCP 헤더의 시작 위치는 패킷 시작 주소에 Ethernet 헤더 길이와 앞서 계산한 IPv4 헤더 길이를 더해 구한다.

```text
TCP 헤더 시작 위치 = 패킷 시작 + 14 + IPv4 헤더 길이(ip_hl)
```

TCP 역시 옵션에 따라 헤더 길이가 달라진다. **Data Offset** 필드가 헤더 길이를 4바이트 단위로 나타내므로, 해당 비트를 추출해 `4`를 곱한다.

현재 구현된 TCP 구조체에서 `th_hl` 배열은 TCP 헤더의 바이트 오프셋 `4`부터 시작한다. 따라서 `th_hl[8]`이 TCP 헤더 기준 오프셋 `12` 바이트에 해당하며, 이 바이트의 상위 4비트를 시프트 연산으로 추출한다.

```c
uint8_t tcp_hl = (tcp->th_hl[8] >> 4) * 4;
```

TCP 헤더에서는 **Source Port와 Destination Port**를 읽어 출력하고, 계산한 `tcp_hl` 값은 Payload 시작 위치를 찾는 데 사용한다.

### Payload 시작 위치 계산 및 출력

Ethernet, IPv4, TCP 헤더의 길이를 모두 더하면 TCP Payload의 시작 위치가 된다.

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

Payload는 길이가 길더라도 **앞부분 최대 20바이트까지만 16진수로 출력**하도록 구현했다. 전체 캡처 길이(`header->caplen`)와 Payload 시작 오프셋을 비교해, 남은 바이트가 있으면 데이터를 출력하고 없으면 `No Data`를 표시한다.

3-way handshake 과정의 SYN, ACK 패킷처럼 제어 목적으로만 전송되는 세그먼트는 TCP 헤더 뒤에 애플리케이션 데이터가 존재하지 않으며, 실제 캡처 결과에서도 `No Data`로 출력되는 것을 확인할 수 있다.

## 05. 바이트 오프셋으로 정리한 패킷 구조

각 계층 헤더의 시작 위치와 길이 계산 기준을 하나의 흐름으로 정리하면 다음과 같다.

| 구간 | 패킷 시작 기준 오프셋 | 길이 산출 기준 |
| :--- | :--- | :--- |
| **Ethernet 헤더** | `0` | 고정 14바이트 가정 |
| **IPv4 헤더** | `14` | `IHL × 4` |
| **TCP 헤더** | `14 + ip_hl` | `Data Offset × 4` |
| **Payload** | `14 + ip_hl + tcp_hl` | 앞선 세 헤더 길이의 합을 시작 위치로 사용 |

예를 들어 IPv4와 TCP 헤더에 별도 옵션이 없어 각각 20바이트인 경우, Payload는 오프셋 `54`에서 시작한다.

```text
0                 14                 34                 54
│ Ethernet Header │ IPv4 Header      │ TCP Header       │ Payload
└─ 14 bytes ──────┴─ 20 bytes ───────┴─ 20 bytes ───────┘

Payload 시작 오프셋 = 14 + 20 + 20 = 54
```

`libpcap`이 전달하는 패킷은 처음부터 주소나 포트 단위로 가공된 객체가 아니라 1차원 바이트 배열(`const u_char *`)이다. 따라서 분석 프로그램은 각 헤더의 길이 필드를 순차적으로 읽어 다음 계층의 오프셋을 직접 계산해야 한다.

## 06. 구현 범위 및 한계점

### 현재 구현 범위

본 프로그램은 패킷 구조 파악을 위한 기본 구현으로, 지원 범위는 다음과 같다.

![패킷 캡처 프로그램 작동 화면]({{ '/assets/uploads/packet-capture-tool-running.png' | relative_url }})
*[그림 1] 프로그램 작동 화면*

| 항목 | 현재 구현 내용 |
| :--- | :--- |
| **패킷 수집** | 지정한 인터페이스에서 실시간 캡처 |
| **분석 대상** | 14바이트 Ethernet → IPv4 → TCP |
| **주소·포트 출력** | 출발지·목적지 MAC, IPv4 주소, TCP 포트 |
| **데이터 출력** | TCP 헤더 이후 캡처 데이터 최대 20바이트 (Hex) |
| **기타 프로토콜** | UDP·ARP·IPv6 등은 필터링하여 생략 |
| **파일 입출력** | `.pcap` 파일 저장 및 불러오기 미지원 |

---

## 참고 자료

- [GitHub · packet-capture-tool](https://github.com/cprtmchzh/packet-capture-tool)
- [libpcap · pcap_datalink()](https://www.tcpdump.org/manpages/pcap_datalink.3pcap.html)
- [RFC 791 · Internet Protocol](https://www.rfc-editor.org/rfc/rfc791)
- [RFC 9293 · Transmission Control Protocol](https://www.rfc-editor.org/rfc/rfc9293)

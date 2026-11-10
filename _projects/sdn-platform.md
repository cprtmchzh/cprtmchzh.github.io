---
title: "SDN Platform: 탐지부터 네트워크 대응까지"
date: 2026-11-10 00:00:00 +0900
description: "네트워크 이상 징후를 탐지하고 SDN 컨트롤러로 차단·속도 제한 정책을 적용한 뒤 상태를 추적하는 보안 자동화 플랫폼."
type: SECURITY
category: security
category_ko: 보안
tags: ["SDN", "Network Security", "OpenFlow", "Python", "FastAPI"]
thumbnail: ""
sample: false
repo_url: "https://github.com/netxt-level/sdn-platform"
---

> **SDN Platform은 네트워크 트래픽의 이상 징후를 탐지하고, 대응 정책을 SDN 컨트롤러로 적용한 뒤 그 상태를 추적하는 네트워크 보안 자동화 플랫폼이다.**

| 항목 | 내용 |
| :--- | :--- |
| **프로젝트 범위** | SDN 기반 보안 자동화 MVP와 Mininet·Open vSwitch 격리 실험망 |
| **핵심 흐름** | 관측 → 탐지 → 정책 판단 → 대응 적용 → 상태 확인 |
| **주요 구성** | Analyzer · Backend · Controller · Frontend |
| **담당 범위** | 패킷 수집·탐지, 정책 생성, OpenFlow 규칙·OVS Meter 적용, 경로 제어와 실험 환경 구현 |
| **검증 상태** | 주요 데이터 플레인·탐지 연계 시나리오 구성; 일부 통합 시나리오의 API Key 전달 보완 및 재검증 필요 |

Analyzer가 패킷을 수집해 탐지 근거와 대응 후보를 만들면, Backend가 자동 대응 설정과 심각도를 평가한다. Controller는 결정된 정책을 OpenFlow 규칙으로 변환해 스위치에 적용하고, 결과와 규칙 상태를 Backend에 반환한다. Frontend는 트래픽·보안 이벤트·토폴로지와 대응 상태를 운영자에게 보여준다.[^overview]

**처리 흐름**

1. **관측:** OVS Mirror로 패킷을 복제하고 Analyzer에서 메타데이터를 집계한다.
2. **탐지:** 시간창과 임계값으로 이상 패턴을 판단하고 이벤트를 전송한다.
3. **정책 판단:** Backend가 자동 대응 설정과 이벤트 심각도를 확인한다.
4. **대응 적용:** Controller가 DROP 또는 RATE_LIMIT 등의 OpenFlow 정책을 스위치에 설치한다.
5. **상태 확인:** Barrier 응답과 Flow 상태를 추적하고 Backend와 Controller의 상태를 재조정한다.

---

## 01. 프로젝트 목표와 SDN의 역할

보안 대응을 자동화하려면 어떤 트래픽이 의심스러운지 판단하는 과정과, 그 트래픽을 네트워크에서 어떻게 처리할지 결정하는 과정이 연결되어야 한다. 또한 차단 명령을 요청한 뒤에는 스위치가 해당 명령을 처리했는지, 규칙이 계속 유지되고 있는지도 확인해야 한다.

이 프로젝트에서는 **SDN(Software-Defined Networking) 컨트롤러가 스위치의 전달 규칙(Flow Rule)을 프로그램으로 제어하는 구조**를 활용했다. Backend가 출발지·목적지·프로토콜 등의 조건과 대응 동작을 요청하면, Controller가 이를 OpenFlow 규칙으로 변환해 Open vSwitch에 전달한다.

탐지와 정책 판단, 네트워크 제어의 책임도 나눴다. Analyzer는 탐지 근거와 대응 후보를 만들고, Backend는 자동 대응 설정과 심각도를 평가한다. Controller는 결정된 정책을 스위치에 적용하고 결과를 반환한다. 각 구성요소가 맡은 역할을 기준으로 전체 흐름을 연결했다.[^overview]

---

## 02. 전체 시스템 구성

| 구성요소 | 주요 기술 | 역할 |
| --- | --- | --- |
| **Analyzer** | Python, Scapy, SQLite | 패킷 캡처, 트래픽 집계, 이상 징후 탐지, 전송 대기 데이터 보존 |
| **Backend** | Python, FastAPI, SQLAlchemy | 이벤트 저장, 대응 정책 판단, Flow 상태 관리, Controller 연동 |
| **Controller** | OS-Ken, OpenFlow 1.3, FastAPI | 스위치 연결, 호스트 학습, 경로 계산, Flow Rule과 Meter 적용 |
| **Frontend** | Next.js, React, TypeScript | 트래픽·이벤트·토폴로지 표시, 규칙 관리와 수동 대응 |
| **저장소** | PostgreSQL, InfluxDB, Elasticsearch | 운영 상태, 시계열 지표, 보안 이벤트 저장 |
| **실험 환경** | Mininet, Open vSwitch, Docker, Multipass | 가상 네트워크 구성과 탐지·대응 시나리오 실행 |

저장소는 데이터 성격에 따라 나눴다. PostgreSQL에는 Flow Rule, 대응 내역, Analyzer 상태와 런타임 설정을 저장한다. InfluxDB에는 트래픽과 프로토콜, 호스트별 시계열 지표를 저장하고, Elasticsearch에는 보안 이벤트와 패킷 요약 문서를 저장한다.[^stack]

Controller는 OS-Ken으로 OpenFlow 이벤트를 처리하면서 같은 프로세스의 별도 스레드에서 FastAPI를 실행한다. Backend가 HTTP API로 요청한 정책을 Controller가 OpenFlow 메시지로 바꾸는 연결 구조다. 스위치 연결 정보, 호스트 정보, 토폴로지, Flow 작업, Meter와 통계는 각각의 모듈에서 관리한다.[^controller]

---

## 03. 트래픽 관측과 이상 징후 탐지

### OVS Mirror를 통한 패킷 수집

Analyzer가 관찰하는 대상은 실험망 안에서 발생하는 트래픽이다. 이를 위해 `s1` 스위치의 지정 포트로 들어오는 패킷을 OVS Mirror로 복제하고, 전용 가상 인터페이스인 `sdn-sensor0`에서 캡처한다.

Mirror 출력 포트와 Sensor는 veth pair로 연결한다. 기본 경로와 우회 경로 양쪽에서 들어오는 트래픽을 관찰하도록 구성해, 실험 토폴로지의 클라이언트와 웹 서버 사이에서 발생하는 요청과 응답을 수집한다. Analyzer는 이 패킷에서 Ethernet, IPv4, TCP, UDP, ICMP 메타데이터를 추출하고 시간창 단위로 집계한다.[^capture]

### 시간창과 임계값을 사용하는 탐지

탐지는 일정 시간 안의 연결 시도, 패킷 수, 송신량, 반복 주기 등을 기준으로 한다. 각 이벤트에는 출발지와 목적지, 심각도, 탐지 조건, 권장 대응과 같은 정보를 담아 Backend에 전달한다.

| 탐지 항목 | 관찰하는 패턴 | 대응 방향 |
| --- | --- | --- |
| **Port Scan** | 같은 출발지·목적지 사이에서 여러 목적지 포트로 발생하는 TCP SYN 시도 | 관찰과 알림 |
| **ICMP Flood** | 같은 출발지·목적지 사이의 높은 ICMP 초당 패킷 수(PPS)와 총 패킷 수 | 조건에 따라 속도 제한 또는 차단 후보 |
| **Server Egress** | 보호 서버가 허용 목록 밖의 목적지로 시작한 TCP 연결 | 운영자 확인 |
| **Lateral Movement** | 보호 서버가 짧은 시간 동안 여러 목적지로 연결을 시도하는 패턴 | Critical 정책에 따른 차단 후보 |
| **Data Exfiltration** | 서버가 시작한 Flow에서 지속적으로 나타나는 비정상 송신량 | 운영자 확인 |
| **C2 Beacon** | 같은 목적지·포트로 반복되는 연결의 주기성과 낮은 변동 | 운영자 확인 |

예를 들어 Port Scan은 SYN 플래그가 있고 ACK가 없는 패킷을 기준으로 같은 출발지·목적지 조합의 고유 목적지 포트 수를 센다. ICMP Flood는 초당 패킷 수와 최소 패킷 수 등의 조건으로 탐지 강도를 판단한다.

보호 서버 행위는 네트워크에서 보이는 **의심 패턴**을 찾는 방식이다. 송신량 증가나 주기적인 연결이 탐지되면 근거를 남겨 운영자가 확인할 수 있도록 한다. 실제 차단 여부는 Backend의 자동 대응 설정과 정책에 따라 결정한다.[^detection]

### 전송 실패에 대비한 Outbox

분석 결과와 보안 이벤트는 Backend로 보내기 전에 SQLite 기반 Outbox에 저장한다. 일시적인 연결 오류나 재시도 가능한 응답이 발생하면 전송 간격을 늘리며 다시 시도하고, 재시도 대상으로 분류되지 않은 오류는 Dead Letter로 보존한다.

이 구조를 통해 Backend 연결이 잠시 끊겨도 전송할 데이터를 남겨둘 수 있도록 했다. 탐지와 전달을 분리해 관리하는 구성이다.[^outbox]

---

## 04. SDN 컨트롤러의 네트워크 제어

### 보안 정책과 L2 전달 테이블 분리

Controller는 **OpenFlow 1.3**을 사용하며, 보안 정책과 일반 전달 규칙을 두 개의 테이블로 나눈다.

| 테이블 | 역할 | 일치하는 규칙이 없을 때 |
| --- | --- | --- |
| **Table 0** | 차단·속도 제한 등 보안 정책 적용 | Table 1로 이동 |
| **Table 1** | 학습한 호스트 사이의 L2 전달 | Controller로 Packet-In 전송 |

패킷은 먼저 보안 정책을 평가받고, 전달 가능한 경우 L2 전달 단계로 넘어간다. 이렇게 구성하면 Backend가 추가한 대응 정책을 일반적인 호스트 간 통신 규칙보다 앞에서 처리할 수 있다.[^flow]

### 호스트 학습과 첫 패킷 처리

Controller는 Packet-In 이벤트에서 호스트의 MAC 주소, IPv4 주소, 연결된 스위치와 포트 정보를 학습한다. 출발지와 목적지 위치를 파악하면 경로에 포함된 스위치에 양방향 전달 규칙을 설치하고, 처음 들어온 패킷은 Packet-Out으로 보낸다.

이후 같은 조건의 패킷은 스위치에 설치된 규칙을 따라 전달된다. 실험망의 access port에는 예상 MAC·IP 바인딩을 두어, 다른 출발지 정보를 사용하는 패킷이 호스트 학습과 전달에 반영되지 않도록 처리했다.[^controller]

### 경로 계산과 링크 장애 대응

실험망에는 `s1–s2–s4`와 `s1–s3–s4` 두 경로를 구성했다. Controller는 활성 스위치와 링크를 그래프로 관리하고, 가중 Dijkstra 알고리즘으로 전달 경로를 계산한다.

포트 상태나 스위치 연결 상태가 바뀌면 그래프를 갱신하고 기존 L2 전달 규칙을 무효화한다. 이후 들어오는 패킷에 대해 사용 가능한 경로를 다시 계산하고 규칙을 설치한다. 기본 경로의 링크가 끊어졌을 때 다른 경로로 통신을 이어갈 수 있도록 구성한 방식이다.[^routing]

### 트래픽 증가 시 TCP 연결 분산

경로 선택에는 포트 통계도 활용한다. `s1`의 두 경로 연결 포트에서 PPS를 계산하고, 설정한 기준을 넘으면 TCP 연결을 두 경로로 나누는 모드로 전환한다.

이때 TCP 연결의 출발지·목적지 주소와 포트, 프로토콜로 만든 식별자를 해시해 경로를 선택한다. 양쪽 endpoint를 정렬해 계산하므로 같은 연결의 요청과 응답이 같은 경로를 선택하도록 했다.

분산 모드 진입과 복귀에는 서로 다른 임계값을 사용하고, 낮은 부하가 일정 횟수 연속 관찰되면 기본 경로로 돌아간다. 부하가 기준 근처에서 움직일 때 경로 선택 모드가 반복해서 바뀌는 상황을 줄이기 위한 처리다.[^distribution]

---

## 05. 보안 정책 적용과 상태 추적

### 탐지 결과를 Flow Rule로 변환

Backend는 보안 이벤트의 심각도와 대응 후보를 확인해 Flow Rule을 생성한다. 자동 대응이 활성화되어 있으면 허용된 후보를 Controller에 전달하고, 비활성화되어 있으면 이벤트와 대응 기록을 남긴다. 운영자는 화면에서 이벤트를 직접 차단하거나 무시·종료 처리할 수 있다.[^policy]

Controller가 지원하는 주요 동작은 다음과 같다.

| 동작 | 처리 방식 |
| --- | --- |
| **DROP** | 조건에 일치하는 패킷을 전달하지 않고 처리를 종료 |
| **RATE_LIMIT** | OVS Meter로 초당 패킷 수를 제한한 뒤 전달 테이블로 이동 |
| **OUTPUT** | 지정된 출력 포트로 패킷 전달 |

`RATE_LIMIT`에는 패킷 수 기준 Meter와 Drop Band를 사용한다. 같은 스위치에서 같은 PPS 설정을 사용하는 규칙은 Meter를 공유하므로, 제한량은 해당 Meter를 함께 사용하는 트래픽에 적용된다. 규칙이 제거되거나 만료되면 참조를 해제하고, 마지막 참조가 없어지면 Meter도 정리한다.[^flow]

### 명령 처리 확인과 Flow 생명주기

Controller는 Flow-Mod와 필요한 Meter-Mod를 보낸 뒤 Barrier Request를 전송한다. 관련 오류를 추적하면서 해당 Barrier Reply를 기다리고, 확인이 끝나면 적용 완료 상태를 반환한다. 오류나 시간 초과, 스위치 연결 해제는 실패 상태로 처리한다.[^barrier]

Backend는 이 결과를 바탕으로 Flow 상태를 관리한다. 설치 과정은 `PENDING`, `APPLYING`, `APPLIED`로 진행하며, 적용에 실패하면 `FAILED`를 기록한다. 삭제와 만료도 `REMOVING`, `REMOVED`, `REMOVE_FAILED`, `EXPIRED`로 구분한다.

Barrier 응답으로 명령의 처리 상태를 확인하고, 실제 대응 효과는 별도의 시나리오에서 Flow 카운터와 통신 결과를 함께 살펴보도록 구성했다.[^lifecycle]

### Backend와 Controller 상태 재조정

Backend는 저장된 규칙과 Controller가 관리하는 규칙 상태를 주기적으로 비교한다. Backend에서 활성 상태인 규칙이 Controller 목록에 없으면 같은 식별자로 다시 설치하고, Controller가 보고한 제거·만료 상태도 반영한다.

이때 규칙의 ID와 OpenFlow cookie를 연결해 같은 규칙을 계속 추적한다. 설치 요청부터 삭제와 만료까지의 기록을 유지하고, 두 구성요소의 상태 차이를 조정하는 구조다.[^lifecycle]

---

## 06. 운영 화면과 실행 환경

운영 화면에서는 트래픽과 탐지 결과를 보고 대응 상태를 확인할 수 있다.

| 화면 | 제공 기능 |
| :--- | :--- |
| **Dashboard** | 트래픽·프로토콜 통계와 서비스 상태 확인 |
| **Security Events** | 탐지 근거 확인, 수동 대응, 이벤트 무시·종료 |
| **Flow Rules** | 규칙과 카운터 확인, 규칙 생성·삭제 |
| **Topology** | 링크와 경로 상태 확인 |
| **Settings** | 자동 대응 설정 변경 |

Backend와 Frontend는 WebSocket으로 상태와 이벤트를 전달한다. API는 역할별 키를 구분하고, WebSocket은 별도로 발급한 단기 토큰을 사용하도록 구성했다.[^operations]

기본 개발 배치는 호스트와 Ubuntu VM을 나눈다.

| 실행 위치 | 구성요소 |
| :--- | :--- |
| **호스트** | Frontend, Backend, PostgreSQL·InfluxDB·Elasticsearch |
| **Ubuntu VM** | Analyzer, Controller, Mininet, Open vSwitch |

macOS·Windows 개발 환경에서는 Multipass로 Linux 기반 데이터 플레인을 구성한다.

Sensor 인터페이스는 Mininet 토폴로지와 수명주기를 분리해 유지하고, 실험망을 시작할 때 Mirror를 연결한다. 이를 통해 실험 시나리오를 다시 실행할 때도 Analyzer가 사용할 캡처 인터페이스를 유지할 수 있도록 했다.[^environment]

---

## 07. 담당 범위와 구현 결과

이 프로젝트에서는 핵심 개발을 맡아 다음 기능을 연결했다.

- **관측·탐지:** 패킷 수집과 트래픽 분석, Port Scan·ICMP Flood 탐지
- **정책·제어:** 대응 정책 생성, OpenFlow 규칙과 OVS Meter 적용
- **전달·경로:** L2 전달, 경로 계산과 링크 장애 대응
- **검증 환경:** Mininet·Open vSwitch 기반 격리 실험망 구성

현재 구현 범위는 **SDN 기반 보안 자동화 MVP와 격리 Lab**이다. 저장소에는 다음 항목을 확인하는 테스트와 시나리오를 포함했다.

- 스위치 연결, 호스트 학습과 기본 통신
- 링크 장애·복구 시 경로 변경
- Flow Rule 설치·삭제와 Barrier 응답
- OVS Meter 적용·정리와 속도 제한 효과
- 기본 경로와 우회 경로에서의 Mirror 패킷 관찰
- Analyzer 탐지부터 Backend 정책 판단, Controller 대응까지의 연계

일부 통합 시나리오는 API Key 전달이 완비되지 않아 기본 인증 구성에 맞춘 보완이 필요하다. 현재는 구성요소와 검증 시나리오를 구현한 MVP 단계이며, 이 부분을 수정한 뒤 전체 통합 검증을 다시 실행하는 작업이 남아 있다.[^validation]

탐지 범위는 L2~L4 메타데이터와 통신 패턴 중심이다. HTTP·DNS·TLS 내용 분석, PCAP·세션 검색, 다중 Sensor, Controller·Backend 고가용성과 운영 규모 성능 검증은 후속 범위로 남아 있다.

이번 구현에서는 탐지 이벤트가 정책으로 바뀌고, 스위치의 전달 동작에 반영되며, 적용 상태가 다시 Backend와 운영 화면으로 돌아오는 전체 흐름을 하나의 실험 플랫폼으로 연결했다.[^validation]

---

## 08. 참고 코드와 문서

[^overview]: [SDN Platform README](https://github.com/netxt-level/sdn-platform/blob/main/README.md).
[^stack]: [구성요소별 구현 현황](https://github.com/netxt-level/sdn-platform/blob/main/IMPLEMENTATION_STATUS.md), [Analyzer 의존성](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/requirements.txt), [Backend 의존성](https://github.com/netxt-level/sdn-platform/blob/main/backend/requirements.txt), [Frontend 구성](https://github.com/netxt-level/sdn-platform/blob/main/frontend/package.json).
[^controller]: [Controller 이벤트 처리](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/controller.py), [호스트 관리](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/hosts.py), [Controller REST API](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/api.py).
[^capture]: [OVS Mirror와 Sensor 구성](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/docs/analyzer-mirror.md), [패킷 파싱](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/app/packet/parser.py).
[^detection]: [탐지 정책 명세](https://github.com/netxt-level/sdn-platform/blob/main/SECURITY_DETECTION_POLICY.md), [Port Scan 탐지](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/app/detection/port_scan.py), [보호 서버 행위 탐지](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/app/detection/server_behavior.py).
[^outbox]: [Analyzer Outbox](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/app/outbox.py), [Analyzer 전송 처리](https://github.com/netxt-level/sdn-platform/blob/main/analyzer/app/backend_client.py).
[^flow]: [Flow Rule 구성](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/flow_manager.py), [Meter 관리](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/meters.py).
[^routing]: [경로 계산](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/routing.py), [토폴로지와 링크 상태](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/topology.py).
[^distribution]: [TCP 연결 단위 경로 분산](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/path_distribution.py), [Controller 설정](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/config.py), [통계 수집과 경로 갱신](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/controller.py).
[^policy]: [Backend 보안 대응 정책](https://github.com/netxt-level/sdn-platform/blob/main/backend/app/services/security_service.py).
[^barrier]: [Flow 작업과 Barrier 추적](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/controller/app/flow_operations.py).
[^lifecycle]: [Flow 상태 관리와 재조정](https://github.com/netxt-level/sdn-platform/blob/main/backend/app/services/flow_service.py), [주기적 재조정 실행](https://github.com/netxt-level/sdn-platform/blob/main/backend/app/services/flow_reconciler.py), [속도 제한 검증 시나리오](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/mininet/scenarios/rate_limit.py).
[^operations]: [운영 화면과 API 구성](https://github.com/netxt-level/sdn-platform/blob/main/README.md), [현재 운영 기능](https://github.com/netxt-level/sdn-platform/blob/main/IMPLEMENTATION_STATUS.md).
[^environment]: [배치 구조](https://github.com/netxt-level/sdn-platform/blob/main/README.md), [Sensor 수명주기](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/docs/analyzer-mirror.md).
[^validation]: [검증 상태와 남은 범위](https://github.com/netxt-level/sdn-platform/blob/main/IMPLEMENTATION_STATUS.md), [데이터 플레인 검증 스크립트](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/scripts/verify.sh), [탐지·대응 연계 시나리오](https://github.com/netxt-level/sdn-platform/blob/main/data-plane/mininet/scenarios/analyzer_detection_response.py).

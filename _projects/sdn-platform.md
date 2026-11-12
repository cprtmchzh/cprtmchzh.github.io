title: "네트워크 이상 징후 탐지 플랫폼"
date: 2026-08-11 00:00:00 +0900
description: "네트워크 이상 징후를 탐지하고 SDN 컨트롤러로 차단·속도 제한 정책을 적용한 뒤 상태를 추적하는 보안 자동화 플랫폼"
type: SECURITY
category: security
category_ko: 보안
tags: ["SDN", "Network", "OpenFlow", "Python"]
thumbnail: ""
sample: false
repo_url: "https://github.com/netxt-level/sdn-platform"
---

> **네트워크 트래픽의 이상 징후를 탐지하고, SDN 컨트롤러를 통해 차단·속도 제한 정책을 스위치에 즉시 반영한 뒤 규칙의 생명주기를 끝까지 추적하는 네트워크 보안 자동화 플랫폼이다.**

| 항목 | 내용 |
| :--- | :--- |
| **프로젝트 범위** | SDN 기반 보안 자동화 MVP 및 Mininet·Open vSwitch 격리 실험망 구축 |
| **핵심 파이프라인** | 트래픽 관측 → 이상 징후 탐지 → 정책 판단 → OpenFlow 대응 적용 → 상태 동기화 |
| **시스템 구성** | Analyzer · Backend · Controller · Frontend |
| **담당 역할** | 패킷 수집·탐지, 정책 생성, OpenFlow 규칙·OVS Meter 제어, 라우팅 및 실험 환경 구현 |
| **검증 상태** | 주요 데이터 플레인 제어 및 탐지 연계 시나리오 검증 완료 (일부 통합 시나리오의 API Key 전달 보완 예정) |

---

## 01. 문제 정의와 SDN 도입 배경

네트워크 보안 대응을 자동화하려면 **의심스러운 트래픽을 식별하는 분석 영역**과 **해당 트래픽을 네트워크 단에서 실제로 제어하는 영역**이 유기적으로 맞물려야 한다. 또한 단순히 차단 명령을 내리는 데 그치지 않고, 스위치가 그 명령을 정상적으로 처리했는지, 적용된 규칙이 유실 없이 유지되고 있는지도 지속적으로 확인해야 한다.

이 프로젝트에서는 **SDN(Software-Defined Networking) 컨트롤러가 스위치의 전달 규칙(Flow Rule)을 프로그래밍 방식으로 제어하는 구조**를 해법으로 택했다. 각 모듈의 책임을 명확히 분리해 다음과 같은 단일 파이프라인으로 연결했다.

---

## 02. 시스템 아키텍처

시스템은 크게 네 개의 코어 애플리케이션과 데이터 성격에 따라 분리된 세 종류의 저장소, 그리고 이를 검증하기 위한 가상 네트워크 실험망으로 구성된다.

 <figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/uploads/SDNplatform_architecture.png' | relative_url }}"
       alt="SDN Platform 시스템 아키텍처"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 1] SDN Platform 시스템 아키텍처
  </figcaption>
</figure>

| 구성요소 | 역할 | 주요 동작 |
|---|---|---|
| **Host (h1~h4)** | 사용자·공격자·관리자·서비스 서버 역할 | h1은 정상 사용자, h2는 공격 트래픽 발생 주체, h3는 관리자, h4는 보호 대상 서버로 구성 |
| **Switch (S1~S4)** | SDN 기반 트래픽 전달 및 경로 구성 | S1에서 트래픽 진입, S2는 기본 경로, S3는 우회 경로, S4는 목적지 스위치 역할 수행 |
| **SDN Controller** | 네트워크 전달 정책 중앙 제어 | 토폴로지·호스트 정보 관리, 경로 계산, Flow Rule 설치·삭제, 장애 시 경로 재계산, 대응 정책 적용 |
| **분석 서버** | 네트워크 트래픽 분석 및 위협 탐지 | S1에서 관찰한 트래픽을 기반으로 Port Scan, ICMP Flood 등의 이상 행위 탐지 |
| **API 서버** | 분석·제어 계층 연결 | 탐지 이벤트 저장, 대응 정책 판단, Controller에 Flow Rule 적용 요청, Dashboard용 데이터 제공 |
| **Dashboard** | 관리자용 모니터링 및 제어 화면 | 트래픽, 보안 이벤트, Flow Rule, 네트워크 상태 확인 및 수동 대응 |

---

## 03. 트래픽 관측과 이상 징후 탐지 (Analyzer)

<figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/uploads/sdn-security-events.png' | relative_url }}"
       alt="SDN Platform 보안 이벤트 페이지"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 2] SDN Platform 보안 이벤트 페이지
  </figcaption>
</figure>

### 1) OVS Mirror와 veth 기반 패킷 수집
Analyzer는 실험망 내부를 흐르는 트래픽을 비침투적으로 관찰한다. 코어 스위치인 `s1`의 지정 포트로 유입되는 패킷을 **OVS Mirror**로 복제하고, 연결된 전용 가상 인터페이스(`sdn-sensor0`)에서 이를 캡처한다. 

기본 경로와 우회 경로 양쪽의 트래픽을 모두 수집할 수 있는 위치에 미러링을 구성해, 경로가 변경되더라도 클라이언트와 웹 서버 간의 전체 통신에서 Ethernet, IPv4, TCP, UDP, ICMP 메타데이터를 누락 없이 추출하고 시간창 단위로 집계한다.

### 2) 시간창과 임계값 기반 탐지

| 탐지 항목 | 주요 관측 지표 및 패턴 | 기본 대응 방향 |
| :--- | :--- | :--- |
| **Port Scan** | 동일 출발지·목적지 간 SYN 패킷(ACK 없음)의 고유 목적지 포트 수 급증 | 관찰 및 알림 기록 |
| **ICMP Flood** | 동일 구간 내 임계값을 초과하는 ICMP 초당 패킷 수(PPS) 및 누적 패킷 수 | 속도 제한 또는 차단 후보 |
| **Lateral Movement** | 보호 대상 서버가 짧은 시간 동안 내부의 여러 목적지로 연결을 시도하는 패턴 | Critical 정책에 따른 즉시 차단 후보 |
| **Server Egress** | 보호 대상 서버가 사전 허용 목록(Whitelist) 외부의 목적지로 시작한 TCP 연결 | 근거 기록 및 운영자 확인 유도 |
| **Data Exfiltration** | 보호 대상 서버에서 시작된 Flow에서 지속적으로 발생하는 비정상 대용량 송신 | 근거 기록 및 운영자 확인 유도 |
| **C2 Beacon** | 동일 목적지·포트로 반복되는 연결의 시간 간격 주기성과 낮은 변동성(Jitter) | 근거 기록 및 운영자 확인 유도 |

일정 시간 내의 연결 시도 횟수, 초당 패킷 수(PPS), 누적 송신량, 접속 주기 등을 기준으로 6가지 이상 징후를 탐지한다. 네트워크 스캔이나 플러딩 공격은 탐지 강도에 따라 즉각적인 제어 후보를 함께 생성하며, 특정 이상 행위는 정상 업무 트래픽과의 구분을 위해 관측 근거를 남겨 운영자가 판단할 수 있도록 설계했다.

### 3) SQLite Outbox를 통한 전송 신뢰성 확보
탐지된 이벤트와 분석 지표를 Backend로 전송하기 전, 로컬 **SQLite 기반 Outbox**에 먼저 기록한다. 네트워크 지연이나 Backend의 일시적 장애로 전송에 실패하면 지수 백오프(Exponential Backoff) 방식으로 재시도 간격을 늘리며 대기하고, 복구 불가능한 응답 오류는 Dead Letter로 분리 보존한다. 이를 통해 탐지 엔진의 동작과 네트워크 전송 상태를 분리하여 데이터 유실을 방지했다.

---

## 04. SDN 데이터 플레인 제어 (Controller)

### 1) OpenFlow 파이프라인 분리 (Table 0 · Table 1)
Controller는 **OpenFlow 1.3** 멀티 테이블 기능을 활용해 보안 정책 평가와 일반 L2 스위칭을 분리했다.

* **Table 0 (보안 정책 테이블):** 패킷이 스위치에 진입하면 가장 먼저 거치는 테이블이다. 차단(`DROP`)이나 속도 제한(`RATE_LIMIT`) 규칙을 우선 평가하며, 차단 대상이 아닌 정상 패킷만 `Table 1`로 넘긴다.
* **Table 1 (L2 전달 테이블):** 학습된 호스트 간 일반 통신 규칙을 처리한다. 일치하는 규칙이 없는 첫 패킷은 Controller로 `Packet-In`을 보내 경로를 질의한다.

이처럼 파이프라인을 분리함으로써, 하단 L2 라우팅 경로가 어떻게 바뀌든 상관없이 최상단에서 일관되게 보안 정책을 강제할 수 있다.

### 2) 호스트 학습과 스푸핑 방지
Controller는 `Packet-In` 메시지에서 호스트의 MAC, IPv4, 접속 스위치 및 포트 위치를 학습한다. 출발지와 목적지 위치가 모두 파악되면 경로상의 스위치들에 양방향 Flow Rule을 설치하고, 첫 패킷은 `Packet-Out`으로 즉시 전달한다. 

이때 실험망의 말단 Access Port에는 사전에 정의된 **MAC·IP 바인딩 검증**을 적용해, 공격자가 출발지 주소를 위변조한 패킷으로 컨트롤러의 호스트 학습 테이블을 오염시키지 못하도록 방어했다.

### 3) 다중 경로 라우팅과 동적 부하 분산
실험망은 `s1–s2–s4`(기본 경로)와 `s1–s3–s4`(우회 경로)의 이중 경로 토폴로지로 구성되어 있으며, Controller는 활성 스위치와 링크 상태를 그래프로 관리하며 **가중 Dijkstra 알고리즘**으로 최적 경로를 계산한다.

* **링크 장애 자동 우회 (Failover):** 포트 상태나 스위치 연결이 끊어지면 즉시 토폴로지 그래프를 갱신하고 기존 L2 규칙을 무효화한다. 이후 유입되는 패킷에 대해 살아있는 우회 경로로 새 규칙을 설치해 통신 단절을 막는다.
* **PPS 기반 TCP 연결 분산:** `s1` 스위치의 경로 연결 포트에서 PPS를 모니터링하다가 설정 임계값을 넘으면 TCP 트래픽을 두 경로로 나누는 분산 모드로 전환한다.
  * **세션 일관성 유지:** 출발지·목적지의 IP와 포트, 프로토콜(5-tuple)의 양 끝단(Endpoint)을 정렬해 해시값을 계산한다. 이를 통해 동일 TCP 세션의 요청과 응답 패킷이 항상 같은 경로를 타도록 보장했다.
  * **플래핑(Flapping) 방지:** 분산 모드 진입 임계값과 복귀 임계값을 다르게 설정(Hysteresis)하고, 낮은 부하가 일정 횟수 연속 관찰될 때만 기본 경로로 복귀시켜 경로가 빈번하게 뒤바뀌는 현상을 방지했다.

---

## 05. 보안 정책 적용과 상태 동기화 (Backend ↔ Controller)

<figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/uploads/sdn-flow-rules.png' | relative_url }}"
       alt="SDN Platform 제어 및 규칙 관리 페이지"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 3] SDN Platform 제어 및 규칙 관리 페이지
  </figcaption>
</figure>

### 1) 제어 정책 변환과 OVS Meter 참조 관리
Backend가 이벤트 심각도와 자동 대응 설정에 따라 정책 적용을 요청하면, Controller는 이를 스위치 명령으로 변환한다.

| 제어 동작 | OpenFlow 및 OVS 처리 방식 |
| :--- | :--- |
| **DROP** | 조건에 일치하는 패킷을 즉시 폐기하고 파이프라인 처리를 종료 (`Clear-Actions`) |
| **RATE_LIMIT** | OVS Meter(Drop Band)를 연결해 초당 패킷 수(PPS)를 제한한 뒤 통과 패킷만 `Table 1`로 전달 |
| **OUTPUT** | 지정된 출력 포트로 패킷 전달 |

`RATE_LIMIT` 적용 시 동일 스위치 내에서 같은 PPS 제한값을 쓰는 규칙들은 하나의 **OVS Meter ID를 공유**하도록 설계했다. 규칙이 삭제되거나 만료될 때 참조 카운트(Reference Count)를 차감하며, 참조하는 규칙이 하나도 남지 않게 되면 스위치에서 해당 Meter 객체도 함께 정리해 리소스 누수를 막는다.

### 2) Barrier 기반 명령 검증과 Flow 생명주기
비동기 프로토콜인 OpenFlow의 특성상 명령 전송 성공이 곧 스위치 적용 성공을 의미하지는 않는다. Controller는 `Flow-Mod`와 `Meter-Mod`를 전송한 직후 **Barrier Request**를 보내고, 중간에 에러 메시지가 수신되지 않는지 추적하며 `Barrier Reply`가 도착할 때까지 대기한다.

Backend는 이 응답을 바탕으로 규칙의 생명주기를 엄격하게 추적한다.
* **설치 단계:** `PENDING` → `APPLYING` → `APPLIED` (오류·타임아웃 시 `FAILED`)
* **제거 단계:** `REMOVING` → `REMOVED` / `EXPIRED` (실패 시 `REMOVE_FAILED`)

### 3) 상태 재조정 (State Reconciliation)
스위치 재시작이나 일시적 통신 단절로 인해 Backend DB의 상태와 실제 스위치의 Flow 테이블 상태가 어긋날 수 있다. 이를 해결하기 위해 Backend는 주기적으로 Controller의 실제 규칙 목록을 조회해 대조한다.

각 규칙의 고유 ID를 OpenFlow `cookie` 필드에 매핑해 추적하며, Backend에는 `APPLIED` 상태인데 스위치에 존재하지 않는 규칙은 동일 식별자로 재설치하고, 스위치에서 하드 타임아웃 등으로 만료·제거된 규칙은 Backend DB 상태를 업데이트해 양측의 정합성을 유지한다.

---

## 06. 운영 대시보드와 격리 실험 환경

<figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/uploads/sdn-dashboard.png' | relative_url }}"
       alt="SDN Platform 메인 대시보드 페이지"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 4] SDN Platform 메인 대시보드 페이지
  </figcaption>
</figure>

### 1) 실시간 관제 화면 (Frontend)
운영자는 웹 대시보드를 통해 네트워크 상태와 자동 대응 현황을 실시간으로 모니터링하고 개입할 수 있다. Backend와는 단기 토큰으로 인증된 **WebSocket**을 연결해 이벤트와 상태 변화를 지연 없이 수신한다.

| 메뉴 | 주요 제공 기능 |
| :--- | :--- |
| **Dashboard** | 전체 트래픽 대역폭, 프로토콜 비율, 코어 서비스 상태 요약 |
| **Security Events** | 탐지된 이벤트의 상세 근거 조회, 운영자 수동 차단 명령 및 이벤트 무시·종료 처리 |
| **Flow Rules** | 현재 스위치에 설치된 규칙 목록, 매칭 카운터 확인, 수동 규칙 생성 및 삭제 |
| **Topology** | 스위치 간 링크 연결 상태 및 현재 활성화된 라우팅 경로 시각화 |
| **Settings** | 이벤트 유형별 자동 대응(Auto-Response) 활성화 여부 및 임계값 설정 |

### 2) 하이브리드 개발 및 실험 환경
개발 편의성과 네트워크 격리를 동시에 확보하기 위해 호스트 머신과 리눅스 VM으로 실행 환경을 분리했다.

* **호스트 환경:** Frontend, Backend, 데이터 저장소(PostgreSQL, InfluxDB, Elasticsearch)
* **Ubuntu VM (데이터 플레인):** Analyzer, Controller, Mininet, Open vSwitch

특히 패킷을 수집하는 `sdn-sensor0` 인터페이스의 수명주기를 Mininet 토폴로지 스크립트와 분리해 호스트 OS(VM) 수준에서 유지하도록 구성했다. 덕분에 실험 시나리오를 반복하며 Mininet 네트워크를 여러 번 재시작하더라도, Analyzer 프로세스를 중단하지 않고 미러링 포트만 재연결해 연속으로 실험을 이어갈 수 있다.

---

## 07. 담당 역할 및 검증 결과

본 프로젝트에서 데이터 플레인 제어부터 탐지·정책 연동까지 핵심 파이프라인의 설계와 구현을 주도했다.

* **트래픽 관측 및 탐지 구현:** OVS Mirror 연동 패킷 수집기 및 Port Scan, ICMP Flood 등 시간창 기반 탐지 로직 개발
* **보안 정책 및 OpenFlow 제어:** Backend 정책 생성기, OpenFlow 멀티 테이블 규칙 변환, OVS Meter 참조 관리 및 Barrier 검증 로직 구현
* **라우팅 및 부하 분산:** 가중 Dijkstra 기반 경로 계산, 링크 장애 시 자동 우회, 5-tuple 해시 기반 TCP 연결 분산 구현
* **실험망 및 검증 시나리오 구축:** Mininet·OVS 기반 다중 경로 토폴로지 구성 및 통합 테스트 시나리오 작성

구현된 MVP 플랫폼과 격리 실험망을 통해 다음 핵심 시나리오들의 동작을 검증했다.

1. 스위치 연결 수립, MAC·IP 바인딩 기반 호스트 학습 및 정상 L2 통신
2. 주 경로 링크 단절 시 우회 경로로의 즉각적인 규칙 재설치 및 복구
3. Flow Rule 설치·삭제 시 Barrier 응답 검증 및 주기적 상태 동기화(Reconciliation) 동작
4. OVS Meter 적용을 통한 ICMP Flood 트래픽의 PPS 제한 효과 및 규칙 만료 시 Meter 자동 정리
5. 기본 경로와 우회 경로 양쪽에서의 OVS Mirror 패킷 누락 없는 수집
6. Analyzer의 이상 징후 탐지부터 Backend 정책 판단, Controller의 스위치 차단 적용까지 이어지는 End-to-End 자동화 흐름

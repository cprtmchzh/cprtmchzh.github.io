---
title: "MongoBleed(CVE-2025-14847) PoC 분석 및 재현 실습"
date: 2026-04-09 00:00:00 +0900
category_slug: bug-bounty
thumbnail: ""
description: "MongoDB의 zlib 압축 처리 취약점인 MongoBleed 분석 및 로컬 Docker 환경에서 PoC 재현."
tags: ["MongoBleed", "CVE-2025-14847", "MongoDB", "PoC", "취약점분석"]
sample: false
---

> **실제 압축 해제 길이와 할당된 버퍼 크기를 혼동하면 어떤 문제가 발생할까?** 로컬 환경에서 MongoBleed를 재현하며, 조작된 메시지가 메모리 정보 노출로 이어지는 과정과 패치 전후의 동작 차이를 확인했다.

MongoDB에서 공개된 **MongoBleed(CVE-2025-14847)** 취약점을 대상으로 공개 PoC의 동작을 분석하고, Docker 기반 테스트 환경에서 이를 재현했다.

이번 실습의 목표는 **조작된 입력값이 MongoDB 내부 처리를 거쳐 메모리 정보 노출로 이어지는 과정을 확인하는 것**이다. PoC 실행 결과를 수집하고 Wireshark로 요청·응답 패킷을 분석한 뒤, 패치된 버전에서 동일한 테스트를 수행해 결과를 비교했다.

| 실습 항목 | 내용 |
| :--- | :--- |
| **분석 대상** | MongoBleed · `CVE-2025-14847` |
| **핵심 분석 지점** | `OP_COMPRESSED`, zlib 압축 해제 길이, BSON 오류 응답 |
| **재현 환경** | 로컬 Docker 기반 MongoDB 컨테이너 |
| **비교 버전** | MongoDB `6.0.26` → `6.0.27` |

---

## 01. MongoBleed 개요

MongoBleed는 MongoDB의 **zlib 압축 메시지 처리 과정에서 초기화되지 않은 힙 메모리가 노출되는 취약점**이다. 네트워크를 통해 MongoDB에 접근할 수 있는 환경이라면 별도의 인증 없이도 트리거할 수 있다.

원인은 압축 메시지에 선언된 길이와 실제 압축 해제 길이의 불일치다. 서버가 실제 압축 해제된 데이터보다 넓은 메모리 영역을 유효한 메시지로 인식하면서, 후속 처리 과정에서 기존 힙 메모리의 일부가 함께 읽히게 된다.

| 항목 | 내용 |
| :--- | :--- |
| **CVE** | `CVE-2025-14847` |
| **취약점 유형** | 초기화되지 않은 힙 메모리 읽기에 따른 정보 노출 |
| **인증 필요 여부** | 인증 이전 단계에서 발생 가능 |
| **심각도** | MongoDB CNA 기준 CVSS v4.0 **8.7 · High** |
| **실습 대상** | MongoDB `6.0.26`의 zlib 압축 메시지 처리 |

인증 조건과 심각도는 [NVD에 등록된 CVE-2025-14847 정보](https://nvd.nist.gov/vuln/detail/CVE-2025-14847)를 기준으로 정리했다.

## 02. 취약점 발생 원리

### OP_COMPRESSED 메시지 구조

MongoDB는 네트워크 통신량을 줄이기 위해 기존 메시지를 압축하고, 이를 `OP_COMPRESSED` 구조로 감싸 전송한다.

| 필드 | 역할 |
| :--- | :--- |
| `MsgHeader` | 메시지 길이, 요청 식별자, opcode 등 공통 헤더 |
| `originalOpcode` | 압축 전 원본 메시지의 opcode |
| `uncompressedSize` | 공통 헤더를 제외한 **압축 해제 결과의 크기** |
| `compressorId` | 사용한 압축 알고리즘의 식별자 |
| `compressedMessage` | 공통 헤더를 제외한 원본 메시지 본문의 압축 데이터 |

공식 명세 기준 `OP_COMPRESSED`의 opcode는 `2012`, `OP_MSG`는 `2013`이며, zlib의 `compressorId`는 `2`다. ([MongoDB Wire Protocol 공식 문서](https://www.mongodb.com/docs/manual/reference/mongodb-wire-protocol/))

### 실제 데이터 길이와 버퍼 크기의 불일치

공격자는 **실제 압축 해제 크기보다 큰 `uncompressedSize`**를 선언해 전송할 수 있다. 서버는 선언된 크기만큼 버퍼를 할당하지만, 압축을 해제하면 버퍼의 앞부분만 실제 데이터로 채워진다.

문제는 압축 해제 결과를 반환할 때 발생한다. 취약한 버전에서는 실제로 채워진 데이터 길이 대신 할당된 버퍼의 전체 크기를 반환한다. 이로 인해 초기화되지 않은 나머지 버퍼 영역까지 후속 메시지 처리 대상에 포함된다.

이때 버퍼는 **압축 해제 데이터로 채워진 앞부분**과 **초기화되지 않은 나머지 영역**으로 나뉜다. 실제 데이터 길이는 앞부분만 가리키지만, 할당된 버퍼 크기에는 두 영역이 모두 포함된다.

### BSON 파싱 오류가 응답으로 이어지는 과정

공개 PoC는 BSON 문서의 길이 필드도 함께 조작한다. 후속 BSON 파싱 과정에서 초기화되지 않은 메모리 영역이 필드명 등으로 읽히며, 파싱 오류를 알리는 서버 응답에 해당 메모리 내용이 포함된다.

1. 서버가 조작된 `OP_COMPRESSED` 요청을 받고, 선언된 크기에 맞춰 버퍼를 준비한다.
2. 압축을 해제하면 버퍼 앞부분만 데이터로 채워지고 나머지 영역은 초기화되지 않은 상태로 남을 수 있다.
3. 취약한 처리에서는 **실제 데이터 길이 대신 버퍼 전체를 유효한 메시지로 취급**한다.
4. BSON 파서가 남은 영역까지 필드명 등으로 읽으면서 파싱 오류가 발생할 수 있다.
5. 오류를 설명하는 응답에 읽어 들인 내용이 포함되면, 기존 힙 메모리의 조각이 클라이언트에 전달될 수 있다.

위 흐름은 [공개 PoC의 설명과 코드](https://github.com/joe-desimone/mongobleed)를 바탕으로 정리했다. 핵심은 **서버가 초기화되지 않은 메모리 조각을 오류 응답의 일부로 클라이언트에 반환한다는 점**이다.

## 03. 실습 환경

재현은 **로컬 Docker 기반 테스트 환경**에서 진행했다. 호스트에서 실행한 Python PoC가 MongoDB 컨테이너에 조작된 요청을 보내고 응답을 수집하는 구조다.

| 구성 | 버전 및 용도 |
| :--- | :--- |
| **Docker Desktop** | `4.66.0` |
| **MongoDB (취약 버전)** | `6.0.26` |
| **MongoDB (패치 버전)** | `6.0.27` |
| **Python** | `3.13.1` |
| **Wireshark** | 요청·응답 패킷 분석 |

Python PoC는 TCP로 요청을 전송하고 MongoDB가 반환한 오류 응답을 수집했다. Wireshark에서는 같은 통신의 요청·응답 패킷을 관찰해 PoC의 출력과 비교했다.

## 04. 공개 PoC 코드 분석

실습에는 Joe Desimone이 공개한 [`mongobleed.py`](https://github.com/joe-desimone/mongobleed/blob/main/mongobleed.py)를 사용했다. 코드는 요청 생성부터 결과 저장까지 총 4단계로 동작한다.

### 1. 조작된 요청 생성

길이를 조작한 BSON 데이터를 생성해 `OP_MSG` 본문으로 구성한 뒤 zlib으로 압축한다. 이후 압축된 데이터를 `OP_COMPRESSED` 구조로 감싼다.

| 값 | 의미 |
| :--- | :--- |
| `originalOpcode = 2013` | 압축 전 메시지가 `OP_MSG`임을 명시 |
| `uncompressedSize` | 실제 압축 해제 크기보다 크게 지정한 길이 |
| `compressorId = 2` | zlib 압축 사용 |
| `compressedMessage` | 조작된 BSON을 포함한 압축 데이터 |

여기서 **BSON 내부에 선언한 문서 길이와 `OP_COMPRESSED`에 선언한 `uncompressedSize`는 서로 다른 역할을 한다.** 후자는 서버가 과도한 크기의 버퍼를 유효 데이터로 넘기게 만들고, 전자는 BSON 파서가 그 버퍼의 끝부분까지 읽도록 유도한다.

### 2. TCP 전송 및 응답 복원

생성한 메시지는 일반 MongoDB 드라이버를 거치지 않고 TCP 소켓을 통해 서버에 직접 전송한다.

응답 수신 시에는 패킷이 분할되어 도착할 수 있으므로, 응답 헤더의 메시지 길이를 먼저 확인한 뒤 전체 길이에 도달할 때까지 데이터를 읽어 하나의 메시지로 조립한다.

### 3. 오류 응답에서 데이터 추출

수신한 응답이 `OP_COMPRESSED` 형태라면 압축을 해제하고, 그렇지 않으면 공통 헤더 이후의 본문을 바로 읽는다.

PoC는 응답 본문에서 **BSON 오류 메시지에 포함된 필드명과 인식되지 않은 타입(type) 값**을 파싱해 메모리 조각을 추출한다.

### 4. 중복 제거 및 파일 저장

문서 길이 값을 변경해 가며 요청을 반복 전송하고 응답에서 메모리 조각을 수집한다. 이미 확인된 조각은 중복을 제거한 뒤 바이너리 파일로 저장한다.

전체 과정은 **요청 생성과 전송**, **응답 복원과 데이터 추출**, **중복 제거와 파일 저장**으로 묶을 수 있다.

이후 저장된 파일에서 문자열을 추출해 실제로 어떤 정보가 노출되었는지 확인했다.

## 05. 재현 결과

수집된 데이터를 확인한 결과, **테스트를 위해 DB에 입력해 둔 문자열 일부와 Docker·컨테이너 환경 관련 경로**가 노출된 것을 확인했다.

[![수집 파일을 문자열로 확인한 화면. 읽기 어려운 바이트 사이에 desktop-containerd와 overlayfs 스냅샷 경로가 나타난다.]({{ '/assets/uploads/mongobleed/leaked-memory-strings.png' | relative_url }})]({{ '/assets/uploads/mongobleed/leaked-memory-strings.png' | relative_url }})

*그림 1. 수집된 데이터를 문자열로 확인한 결과 일부. 출처: 실습 발표자료 16쪽. 이미지를 누르면 원본 크기로 볼 수 있다.*

| 구분 | 확인된 내용 | 의미 |
| :--- | :--- | :--- |
| **테스트 DB 데이터** | 토큰·Secret Key 형태로 입력해 둔 문자열 일부 | DB가 처리했던 데이터 조각이 힙 메모리에 남아 있을 경우 노출 가능 |
| **Docker 런타임 정보** | containerd·overlayfs 관련 경로 | 호스트 및 컨테이너 런타임 환경 정보 노출 |
| **컨테이너 내부 정보** | 데이터 볼륨, `/data/db`, 시스템 경로 | 컨테이너의 마운트 구조 및 내부 경로 파악 가능 |

### 테스트 DB 데이터 노출

사전에 입력해 둔 테스트용 토큰과 Secret Key 문자열 일부가 결과 파일에서 확인됐다. 서버가 이전에 처리했던 데이터가 프로세스 힙 메모리에 남아 있을 때, 본 취약점을 통해 외부로 유출될 수 있음을 보여준다.

[![수집 결과에서 골라낸 테스트 문자열 조각과 Docker 볼륨, /data/db, /etc/hosts 등의 경로.]({{ '/assets/uploads/mongobleed/filtered-strings.png' | relative_url }})]({{ '/assets/uploads/mongobleed/filtered-strings.png' | relative_url }})

*그림 2. 발표자료에서 주요 문자열을 필터링해 정리한 화면. 테스트 문자열 조각과 실행 환경의 경로가 함께 나타난다. 출처: 실습 발표자료 16쪽.*

### Docker 및 컨테이너 관련 경로 노출

Docker Desktop과 containerd의 overlayfs 관련 경로가 다음과 같이 확인됐다.

```text
/var/lib/desktop-containerd/...
```

데이터 볼륨과 컨테이너 내부 파일시스템 경로 문자열도 함께 추출됐다.

```text
/docker/volumes/mongobleed-poc_mongodb_data/_data
/data/db
/etc/resolv.conf
/etc/hostname
/etc/hosts
/proc
/dev
/sys
```

> **결과 해석:** 노출된 데이터는 DB 내부 데이터뿐만 아니라 실행 환경을 파악할 수 있는 단서도 포함한다. 단, 경로 문자열이 노출되었다는 것은 메모리에 남아 있던 경로 텍스트가 읽힌 것이며, 해당 파일의 내부 내용 전체가 유출되었다는 의미는 아니다.

## 06. Wireshark 패킷 분석

PoC 실행과 동시에 Wireshark로 로컬 루프백 패킷을 캡처해 실제 네트워크 통신을 확인했다.

| 확인 지점 | 패킷 분석 내용 |
| :--- | :--- |
| **요청 패킷** | Python PoC가 전송한 `OP_COMPRESSED` 메시지 구조 확인 |
| **응답 패킷** | MongoDB가 반환한 BSON 파싱 오류 응답 확인 |
| **노출 문자열** | 오류 응답 페이로드 내부에 포함된 overlayfs·containerd 경로 문자열 확인 |

[![Wireshark에서 선택한 MongoDB 오류 응답. 압축 해제된 데이터의 문자열 영역에 BSON 오류 메시지와 containerd·overlayfs 관련 경로가 함께 표시된다.]({{ '/assets/uploads/mongobleed/wireshark-error-response.png' | relative_url }})]({{ '/assets/uploads/mongobleed/wireshark-error-response.png' | relative_url }})

*그림 3. 로컬 MongoDB의 오류 응답을 확인한 Wireshark 화면. 오른쪽 문자열 영역에서 BSON 파싱 오류와 환경 관련 경로를 볼 수 있다. 출처: 실습 발표자료 13쪽.*

패킷에서 확인한 오류 응답을 앞서 설명한 압축 해제·BSON 파싱 과정과 연결해 살펴봤다.

패킷 캡처를 통해 **PoC 코드가 생성한 바이트 스트림, 서버가 반환한 오류 응답 패킷, 그리고 최종 파일로 추출된 문자열이 서로 일치함**을 검증했다.

## 07. 패치 전후 비교

취약점 재현 후 MongoDB를 **`6.0.27`로 업데이트**하고 동일한 테스트를 반복했다. 해당 버전은 MongoDB 보안 권고([SERVER-115508](https://jira.mongodb.org/browse/SERVER-115508))에 명시된 패치 버전이다.

### 패치 코드 분석

zlib 압축 해제 로직의 핵심 수정 사항은 **할당된 버퍼 크기가 아니라 실제 압축 해제된 데이터 길이를 반환하도록 변경한 것**이다.

```diff
- return output.length();
+ return length;
```

`length` 변수는 zlib의 `uncompress()` 호출 후 실제 출력된 바이트 길이로 갱신된다. 패치 전에는 버퍼 전체 크기인 `output.length()`를 반환했으나, 패치 후에는 실제 데이터 길이인 `length`를 반환하도록 수정됐다. ([MongoDB 패치 커밋 소스](https://github.com/mongodb/mongo/blob/505b660a14698bd2b5233bd94da3917b585c5728/src/mongo/transport/message_compressor_zlib.cpp#L58-L70))

### 재테스트 결과 비교

| 비교 항목 | 패치 전 (`6.0.26`) | 패치 후 (`6.0.27`) |
| :--- | :--- | :--- |
| **테스트 방식** | 공개 PoC 요청 전송 | 동일 조건에서 재전송 |
| **메모리 정보 노출** | 테스트 문자열 및 컨테이너 경로 노출 확인 | 메모리 노출 현상 발생하지 않음 |

[![MongoDB 6.0.27로 업데이트한 뒤 재테스트 중 촬영한 Wireshark 화면. 선택된 항목은 클라이언트에서 서버의 27017 포트로 보낸 요청 패킷이다.]({{ '/assets/uploads/mongobleed/patched-retest-request.png' | relative_url }})]({{ '/assets/uploads/mongobleed/patched-retest-request.png' | relative_url }})

*그림 4. MongoDB 6.0.27에서 재테스트한 당시의 패킷 화면. 선택된 항목은 서버로 보낸 요청이며, 화면의 `Malformed Packet` 표시는 Wireshark의 패킷 해석 결과다. 출처: 실습 발표자료 20쪽.*

버전 업데이트 후 동일한 PoC를 실행했을 때, 이전과 같은 메모리 조각 노출은 발생하지 않았다. 반환 길이 수정만으로 초기화되지 않은 메모리 영역에 대한 접근이 차단된 것을 확인할 수 있다.

## 08. 대응 방안

가장 확실한 대응은 **취약점이 패치된 버전으로 업데이트하는 것**이다. 6.0 계열에서는 `6.0.27` 이상으로 업데이트해야 하며, 운영 중인 버전에 맞춰 공식 보안 권고의 패치 버전을 확인해야 한다.

| 우선순위 | 대응 방안 | 목적 |
| :--- | :--- | :--- |
| **1** | 패치된 버전으로 MongoDB 업데이트 | 취약한 압축 해제 길이 반환 로직 수정 |
| **2** | 서버 허용 압축 알고리즘에서 `zlib` 제외 | 즉시 업데이트가 불가능할 경우 취약 경로 비활성화 |
| **3** | 외부 직접 노출 차단 및 네트워크 접근 제어 | 신뢰할 수 없는 호스트의 접근 차단 |

즉각적인 업데이트가 어려운 환경이라면, `mongod` 또는 `mongos` 실행 설정(`networkMessageCompressors` 또는 `net.compression.compressors`)에서 `zlib`을 제외해 취약점 트리거를 방지할 수 있다. ([MongoDB 공식 대응 안내](https://jira.mongodb.org/browse/SERVER-115508))

또한 본 취약점은 인증 이전 단계에서 발생하므로, DB 계정 인증 설정과 별개로 방화벽 등을 통해 네트워크 접근 가능 범위를 최소화해야 한다.

## 09. 정리

이번 실습에서는 CVE 공지 확인부터 프로토콜 규격 파악, PoC 코드 분석, 로컬 재현 및 패킷 검증, 패치 코드 비교까지 전 과정을 순차적으로 진행했다.

1. **CVE 조사:** 취약점의 영향도와 발생 조건 확인
2. **프로토콜 분석:** `OP_COMPRESSED` 구조와 길이 필드의 역할 파악
3. **PoC 분석:** 요청 생성·응답 수신·데이터 추출 로직 확인
4. **로컬 재현:** Docker 환경에서 취약 버전(`6.0.26`) 테스트
5. **패킷 검증:** Wireshark를 통해 실제 요청·응답 패킷과 추출 데이터 대조
6. **결과 분석:** 노출된 DB 문자열 및 컨테이너 환경 경로 확인
7. **패치 검증:** 패치 커밋 확인 및 수정 버전(`6.0.27`) 재테스트

단순히 `uncompressedSize`를 조작하는 것만으로 어떻게 메모리 데이터가 유출되는지 이해하기 위해, 압축 해제 함수의 반환값 처리와 후속 BSON 파서의 오류 응답 생성 과정을 연결해 살펴봤다. 또한 DB 내부 데이터뿐 아니라 컨테이너 런타임 경로 같은 시스템 환경 정보가 함께 노출될 수 있다는 점도 실제 데이터로 확인할 수 있었다.

---

## 참고 자료

- [MongoDB Wire Protocol 공식 문서](https://www.mongodb.com/docs/manual/reference/mongodb-wire-protocol/)
- [MongoDB Jira · SERVER-115508](https://jira.mongodb.org/browse/SERVER-115508)
- [MongoDB 수정 소스 · zlib 압축 해제 길이 반환](https://github.com/mongodb/mongo/blob/505b660a14698bd2b5233bd94da3917b585c5728/src/mongo/transport/message_compressor_zlib.cpp)
- [NVD · CVE-2025-14847](https://nvd.nist.gov/vuln/detail/CVE-2025-14847)
- [Joe Desimone · mongobleed.py](https://github.com/joe-desimone/mongobleed/blob/main/mongobleed.py)
- [ASEC · MongoBleed(CVE-2025-14847): 8년간 숨겨져 있던 치명적 MongoDB 메모리 유출 취약점](https://asec.ahnlab.com/ko/92039/)
- 실습 발표자료: 「CVE-2025-14847 MongoBleed 취약점 분석 및 PoC」 (`mongobleed_poc.pdf`, 본문 캡처 출처: 13·16·20쪽)


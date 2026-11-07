---
layout: article
article_type: project
title: Python 자동화 도구
description: 반복적인 파일 정리를 수행하는 CLI 도구의 설계와 구현 과정을 기록합니다.
type: DEVELOPMENT
category: development
category_ko: 개발
status: 설계 노트
tags:
- Python
- CLI
- Automation
sample: true
permalink: /projects/python-automation/
---

## 프로젝트 개요

반복적인 파일 분류 작업을 자동화하는 **명령줄 도구(CLI)**를 구성하는 방법을 살펴보는 설계 노트입니다. 입력과 출력이 분명한 작은 도구를 만들고, 예외 상황을 안전하게 처리하는 데 초점을 둡니다.

## 해결하려는 문제

파일을 수동으로 정리할 때는 이름 규칙이 달라지거나 같은 이름의 파일이 존재하면 실수가 발생하기 쉽습니다. 먼저 **어떤 파일을 이동할지 미리 보여주고**, 사용자 확인 후 실행하도록 작업 순서를 정합니다.

## 구현 과정

1. 입력 디렉터리와 실행 옵션을 정의합니다.
2. 파일 확장자 기준으로 대상 폴더를 계산합니다.
3. 동일한 파일명이 존재하면 덮어쓰지 않고 충돌을 알립니다.
4. 실행 전에 작업 계획을 출력하고 오류를 기록합니다.

### 예시 코드

```python
from pathlib import Path

def destination(file: Path, target_root: Path) -> Path:
    extension = file.suffix.lstrip('.').lower() or 'others'
    return target_root / extension / file.name

print(destination(Path('notes.md'), Path('organized')))
```

## 검증할 항목

| 테스트 | 예상 동작 |
| --- | --- |
| 확장자 없는 파일 | `others` 폴더로 분류 |
| 이름이 같은 파일 | 덮어쓰기 전에 충돌 안내 |
| 존재하지 않는 경로 | 오류 메시지 출력 |

## 결과와 회고

파일 경로 검증과 충돌 처리, 예외 상황을 별도 테스트로 확인한 뒤 실제 파일 이동 기능에 적용합니다.

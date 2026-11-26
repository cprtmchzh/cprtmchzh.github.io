---
title: "자원 비대칭과 프롬프트 가드의 한계"
date: 2026-11-26 00:00:00 +0900
category_slug: research-conference
thumbnail: ""
description: "USENIX Security 2026 논문을 바탕으로 Controlled-Release Prompting의 자원 비대칭 공격, 실증 결과와 방어 설계 시사점을 분석한다."
tags: ["LLM Security", "Prompt Guard", "Paper Review", "USENIX Security"]
sample: false
---

<figure class="review-table" markdown="1" style="text-align: center;">

| 항목 | 내용 |
|---|---|
| **논문명** | Bypassing Prompt Guards in Production with Controlled-Release Prompting |
| **학회** | USENIX Security Symposium 2026 |
| **저자** | Jaiden Fairoze, Sanjam Garg, Keewoo Lee, Mingyuan Wang |
| **연구 분야** | LLM Security, Jailbreak, Prompt Guard |
| **핵심 키워드** | Resource Asymmetry, Controlled-Release Prompting, Safety Alignment |
| **선정 이유** | 프롬프트 입력 필터링 우회에 대한 개인적인 흥미 |
| **원문** | [학회 공식 페이지][1] · [USENIX PDF][2] · [arXiv v4][3] |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 1] 논문 개요</figcaption>
</figure>

---

## 01. 문제의 출발점: 효율성을 위한 설계가 보안의 허점이 될 때

상용 대규모 언어 모델(LLM) 서비스는 악의적인 요청을 차단하고 안전 정책에 어긋나는 응답을 막기 위해 다층적인 방어 체계를 갖춘다. 모델 자체에 안전 정렬(Safety Alignment)을 적용하는 데 그치지 않고, 사용자 입력과 모델 출력을 각각 별도의 가드 모델로 검사하는 구조가 대표적이다.

<figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/archive/controlled-release-prompting-review/guard-pipeline.png' | relative_url }}"
       alt="사용자 입력이 입력 가드, 본 모델, 출력 가드를 거쳐 최종 응답으로 이어지는 흐름"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 1] 입력·출력 가드의 처리 흐름
  </figcaption>
</figure>

문제는 이러한 다중 방어 구조가 실제 서비스 운영 환경의 제약과 맞물릴 때 발생한다. 상용 LLM 서비스는 빠른 응답 속도와 낮은 운영 비용을 유지해야 하므로, 모든 사용자 요청을 최전선에서 걸러내는 입력 가드에 본 모델과 동일한 수준의 연산 자원을 투입하기 어렵다. 자연스럽게 입력 가드는 본 모델보다 훨씬 가벼운 모델이나 짧은 연산 예산으로 동작하게 된다. 그 결과 동일한 입력을 마주하더라도 가드와 본 모델 사이에 의미를 해석하는 능력의 격차가 생기는데, 이 논문은 이를 **자원 비대칭(Resource Asymmetry)**이라 부른다.

이 취약점이 까다로운 이유는 단순히 특정 가드 모델의 성능이 부족해서가 아니라, **보안성과 서비스 운영 효율성 사이의 구조적 충돌**에서 비롯되기 때문이다. 가드를 여러 개 겹쳐 배치하더라도 각 가드에 할당된 연산 자원과 처리 가능한 문맥의 범위가 본 모델에 못 미친다면, 입력에 숨겨진 실제 의도를 끝내 파악하지 못할 수 있다. 기존 보안 벤치마크에서 높은 탐지율을 기록한 모델이라 해도, 자원 비대칭을 겨냥한 공격 앞에서는 무력해질 여지가 남는다.

사실 입력 필터링의 이러한 한계는 앞서 이론적으로 예견된 바 있다. Ball 등의 선행 연구(*On the Impossibility of Separating Intelligence from Judgment: The Computational Intractability of Filtering for AI Alignment*)는 특정 암호학적 가정 아래, 본 모델보다 현저히 적은 연산 자원을 쓰는 입력 필터는 정상 프롬프트와 악의적 프롬프트를 항상 구별할 수 없음을 증명했다<sup class="source-cite"><a href="https://arxiv.org/abs/2507.07341" aria-label="참고문헌 2">2</a></sup>. 다만 선행 연구는 검증을 위해 별도로 구성한 모델을 사용했기에, 이 이론적 한계가 실제 상용 LLM 서비스에서도 그대로 드러나는지는 확인되지 않았다.

Fairoze 등의 이번 연구는 바로 이 공백을 파고든다. 저자들은 모델에 어떠한 수정도 가하지 않은 상태에서, **가드 모델과 본 모델 사이의 자원 비대칭이 실제 상용 LLM 서비스의 보안 취약점으로 이어지는지**를 블랙박스 환경에서 검증하고자 했다<sup class="source-cite"><a href="https://www.usenix.org/conference/usenixsecurity26/presentation/fairoze" aria-label="참고문헌 1">1</a>, <a href="https://arxiv.org/abs/2507.07341" aria-label="참고문헌 2">2</a></sup>. LLM 탈옥을 모델 내부의 정렬 실패로만 바라보던 기존 시각에서 벗어나, 서비스 효율성을 위해 택한 아키텍처 자체가 새로운 공격 표면(Attack Surface)이 될 수 있음을 정면으로 짚은 셈이다. 나아가 이러한 구조적 문제는 탈옥을 넘어 프롬프트 인젝션 탐지 시스템에서도 충분히 재현될 수 있다는 점에서 시사하는 바가 크다.

---

## 02. 핵심 접근법: Controlled-Release Prompting

기존의 인코딩 기반 탈옥 공격은 주로 텍스트의 표면적인 표현을 변형해 안전성 판단을 회피하는 데 초점을 맞췄다. 반면 저자들이 제안한 **Controlled-Release Prompting(CRP)**은 인코딩을 수단으로 활용하되, **입력의 실제 의미를 풀어내는 데 필요한 연산 자원**과 **가드에 허용된 자원** 사이의 간극을 핵심 공격 지점으로 삼는다. 즉 가드 모델 자체의 지능이나 기본 성능이 본 모델과 비슷하더라도, 실제로 사용할 수 있는 자원에 차이가 존재한다면 동일한 입력을 서로 다르게 해석하게 만들 수 있다.

저자들은 이러한 자원 비대칭을 **시간(연산량)**과 **공간(컨텍스트 용량)**이라는 두 축으로 나누어 공격 기법을 설계했다.

**T-R**은 Timed-Release Prompting, **S-R**은 Spaced-Release Prompting을 뜻한다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 구분 | T-R | S-R |
|---|---|---|
| **활용하는 자원** | 시간 및 계산량 | 컨텍스트 처리 용량 |
| **가드의 한계** | 의미를 해석하기 위한 연산 부족 | 전체 문맥을 처리하기 어려움 |
| **핵심 개념** | 연산 복잡도, 추론 예산 | 컨텍스트 윈도우 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 2] T-R과 S-R 비교</figcaption>
</figure>

**Timed-Release Prompting**은 두 모델이 쓸 수 있는 계산량의 차이를 겨냥한다. 가드가 입력 토큰 전체를 빠짐없이 읽어 들인다 해도, 그 안에 담긴 의미를 온전히 해독할 만큼의 추론 예산이 부족하면 위험성을 알아채지 못한다. 반면 **Spaced-Release Prompting**은 한 번에 다룰 수 있는 문맥의 크기 차이를 이용한다. 가드의 컨텍스트 처리 범위가 제한되어 있으면, 넓게 분산된 단서들을 종합해 전체 의도를 파악하기 어렵다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 비교 항목 | 입력 가드 | 본 모델 |
|---|---|---|
| **연산 예산** | 적음 | 많음 |
| **문맥 범위** | 좁음 | 넓음 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 3] 입력 가드와 본 모델의 자원 차이</figcaption>
</figure>

여기서 짚고 넘어가야 할 점은 입력 토큰의 길이가 의미를 해석하는 데 필요한 추론 토큰 수와 반드시 비례하지는 않는다는 사실이다. CRP의 본질은 단순히 프롬프트를 길게 늘이는 데 있지 않다. 동일한 입력이 주어졌을 때, 각 모델이 동원할 수 있는 연산 예산과 문맥 범위의 차이에 따라 전혀 다른 해석 결과에 도달하도록 유도하는 것이 핵심이다.

아울러 저자들은 블랙박스 환경에서 공격의 성패를 엄밀히 따지기 위해 입력 가드 우회와 실제 탈옥을 명확히 구분했다<sup class="source-cite"><a href="https://www.usenix.org/conference/usenixsecurity26/presentation/fairoze" aria-label="참고문헌 1">1</a></sup>. 입력 가드를 통과했다고 해서 본 모델이 곧바로 위험한 답변을 내놓는 것은 아니기 때문이다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 구분 | 평가 기준 |
|---|---|
| **가드 우회(Guard Bypass)** | 입력 가드가 위험한 요청을 탐지하지 못했는가? |
| **모델 탈옥(Jailbreak)** | 본 모델이 안전 정책에 위배되는 응답을 생성했는가? |
| **서비스 수준의 공격 성공** | 안전 정책에 위배되는 정보가 실제 사용자에게 전달되었는가? |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 4] 공격 성공 판정 기준</figcaption>
</figure>

이처럼 단계별 기준을 분리함으로써, 가드의 탐지 실패가 실제 서비스 수준의 정보 유출로 이어지는 경로를 보다 입체적으로 평가할 수 있게 된다.

---

## 03. 실증 평가: 상용 서비스에서 공개 가드 모델까지

저자들의 검증은 크게 두 단계로 나뉜다. 먼저 실제 상용 LLM 서비스에 CRP를 적용해 취약점의 실재 여부를 확인하고, 이어서 공개 가드 모델을 별도로 평가해 자원 비대칭과 탐지 성능 사이의 관계를 들여다보았다.

### 상용 LLM 서비스에서의 공격 검증

저자들은 AdvBench와 HarmBench에서 선정한 12개의 악의적 요청을 바탕으로, 네 개의 상용 LLM 서비스에 Timed-Release Prompting을 적용했다.

<style>
.post-content sup.source-cite { vertical-align: super; font-size: 0.72em; line-height: 0; white-space: nowrap; }
#post-content sup.source-cite a { text-decoration: none; }
.post-content .review-table > .table-shell { margin: 0; }
</style>

<figure class="review-table" markdown="1" style="text-align: center;">

| 모델 | T-R 성공 건수 | 공격 성공률 |
|---|---:|---:|
| Gemini 2.5 Flash | 12/12 | 100% |
| DeepSeek DeepThink | 12/12 | 100% |
| Grok 3 | 12/12 | 100% |
| Mistral Magistral | 11/12 | 91.7% |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 5] 상용 LLM의 T-R 실험 결과</figcaption>
</figure>

성공 건수는 저자들의 판정 기준을 따른다. [원문 §4, 표 4·7][2]

네 서비스 모두에서 90%를 넘는 높은 성공률이 기록되었으며, 세 개 서비스에서는 12건 전부가 성공으로 판정되었다. 별도의 모델 수정 없이도 선행 연구의 이론적 경고가 상용 환경에서 현실화할 수 있음을 실증한 결과다.

다만 이 수치를 액면 그대로 받아들이기 전에 두 가지 조건을 함께 살펴야 한다. 첫째, 논문의 성공 판정 기준에는 최종 답변뿐 아니라 사용자에게 노출된 중간 추론 과정에서의 정보 유출까지 포함된다. 따라서 모든 성공 사례에서 본 모델이 완전한 형태의 유해한 최종 답변을 생성했다고 보기는 어렵다. 둘째, 100%라는 수치는 선정된 12개의 요청을 기준으로 계산된 결과이므로, 이를 모든 유형의 악의적 공격에 대한 일반적 성공률로 확대 해석해서는 안 된다.

### 공개 가드 모델 평가를 통한 원인 분석

상용 서비스는 내부에 어떤 가드 모델이 배치되어 있고 얼마만큼의 자원이 할당되는지 알 수 없는 블랙박스 환경이다. 상용 서비스 공격이 성공했다는 사실만으로는 자원 비대칭이 직접적인 원인이라고 단정 짓기 어렵다. 저자들이 14개의 공개 가드 모델 및 추론 모드를 대상으로 별도의 실험을 수행한 이유가 여기에 있다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 실험 항목 | 내용 |
|---|---|
| **벤치마크 데이터** | Guardrails AI 프롬프트 3,930개 |
| **공격 평가 데이터** | 공격 유형별 프롬프트 4,000개 |
| **평가 지표** | ROC-AUC, F1-score, 평균 탐지 신뢰도 |
| **자원 측정** | 평균 추론 시간 및 출력 토큰 수 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 6] 공개 가드 모델의 평가 조건</figcaption>
</figure>

주요 모델의 평가 결과는 다음과 같다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 모델 | ROC-AUC | T-R 탐지 점수 | S-R 탐지 점수 | 평균 추론 시간 |
|---|---:|---:|---:|---:|
| Prompt Guard 1 | 0.831 | 0.99 | 0.91 | 52 ms |
| Prompt Guard 2 (86M) | 0.853 | 0.21 | 0.12 | 277 ms |
| ShieldGemma | 0.836 | 0.00 | 0.07 | 201 ms |
| Qwen3-32B (Thinking) | 0.888 | 0.46 | 0.23 | 1,463 ms |
| DeepSeek-R1 (Thinking) | 0.911 | 0.95 | 0.96 | 3,486 ms |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 7] 가드 모델별 탐지 성능과 추론 시간</figcaption>
</figure>

탐지 점수는 평균 탐지 신뢰도이며, 분류 임계값은 모델마다 다르다. [원문 표 5][2]

표 7에서 가장 눈에 띄는 대목은 Prompt Guard 1과 Prompt Guard 2(86M)의 대비다. 후속 버전인 Prompt Guard 2는 기존 벤치마크 기준 ROC-AUC가 0.853으로 이전 버전(0.831)보다 향상되었지만, Timed-Release와 Spaced-Release에 대한 평균 탐지 신뢰도는 각각 0.21과 0.12로 급락했다. 기존 벤치마크에서의 우수한 성적이 자원 비대칭 기반의 새로운 공격에 대한 내성까지 담보하지 않음을 여실히 보여주는 대목이다.

반면 DeepSeek-R1(Thinking)처럼 많은 연산 자원을 투입하는 모델은 Timed-Release 0.95, Spaced-Release 0.96이라는 높은 탐지 점수를 기록했지만, 평균 추론 시간 역시 3,486 ms로 크게 늘어났다. 물론 각 모델은 구조와 학습 데이터가 서로 다르므로, 이 비교만으로 연산량과 탐지 성능 사이의 직접적인 인과관계를 단정할 수는 없다. 그럼에도 가드 모델을 평가할 때 기존 벤치마크 점수만이 아니라 새로운 유형의 공격에 대한 대응력과 실제 운영 비용을 함께 따져보아야 한다는 점은 분명해진다.

### 입력 가드 너머에서 드러난 위협

저자들은 입력 가드 우회 외에도 저작권 보호 콘텐츠의 추출과 일부 모델의 중간 추론 과정에서 발생하는 정보 유출 사례를 함께 확인했다<sup class="source-cite"><a href="https://www.usenix.org/conference/usenixsecurity26/presentation/fairoze" aria-label="참고문헌 1">1</a></sup>. 특히 최종 응답 단계에서 악의적 요청을 정상적으로 거부했더라도, 사용자에게 공개되는 중간 추론 과정에 위험한 정보가 그대로 담겨 노출되는 사례는 시사하는 바가 크다. 입력 가드뿐 아니라 최종 출력만 검사하는 방어 방식 역시 완벽한 안전망이 될 수 없음을 보여주기 때문이다.

---

## 04. 비판적 분석: 설계적 시사점과 연구의 한계

### 서비스 아키텍처 자체가 만드는 공격 표면

이 논문이 기존 탈옥 연구들과 결을 달리하는 지점은 개별 모델의 취약점이 아니라 **서비스를 구성하는 설계 방식 자체에 주목했다**는 점이다. 보안성을 높이기 위해 가드의 성능을 끌어올리거나 개수를 늘리면 해결될 것처럼 보이지만, 실제 서비스 환경에서는 지연 시간과 운영 비용이라는 현실적 제약이 뒤따른다.

가드에 더 많은 연산 자원을 배정하면 탐지 성능은 나아질 여지가 있지만 서비스 효율성이 크게 떨어진다. 그렇다고 본 모델이 입력을 먼저 해석한 뒤에 그 결과를 가드에 넘겨 검사하는 방식을 택하면, 가벼운 입력 가드를 앞단에 두는 설계상의 이점이 사라질 뿐 아니라 "본 모델의 해석 결과가 정확하고 신뢰할 만하다"는 새로운 가정이 추가된다. 결국 LLM 보안 체계를 평가할 때는 개별 모델의 탐지 수치만 볼 것이 아니라, 시스템 내 각 구성 요소의 역할과 자원 배분 방식, 전체 아키텍처의 상호작용까지 함께 살필 필요가 있다.

### 연구의 한계와 보완이 필요한 지점

이러한 기여에도 불구하고, 실험 설계와 결과 해석 측면에서는 몇 가지 한계와 아쉬움이 남는다.

**첫째, 실험 결과의 일반화 범위가 좁다.** 상용 LLM 서비스 평가에 사용된 공격 요청은 12건에 불과하다. 선정된 12개 프롬프트가 현실의 다양한 유해 요청 유형을 충분히 대표하는지 검증할 필요가 있으며, 모델과 가드가 수시로 업데이트되는 상용 서비스의 다른 버전에서도 동일한 취약성이 유지되는지 추가 확인이 뒤따라야 한다.

**둘째, 상용 서비스 내부 구조의 불투명성이 완전히 해소되지 않았다.** 저자들은 블랙박스 환경의 한계를 보완하기 위해 공개 가드 모델을 별도로 평가했지만, 이 공개 모델들이 실제 상용 서비스에 탑재된 가드와 동일하다는 보장은 없다. 따라서 상용 서비스에서 관찰된 모든 공격 성공의 원인을 자원 비대칭 하나로 귀결시키기에는 여전히 간극이 존재한다.

**셋째, 자원과 탐지 성능 사이의 엄밀한 인과관계 검증이 아쉽다.** 표 7처럼 서로 다른 가드 모델의 결과를 비교할 때는 연산 자원 외에도 모델 구조, 학습 데이터, 학습 방식 같은 변수가 결과에 혼재된다. 동일한 가드 모델을 고정한 상태에서 다른 조건은 유지하고 추론 예산이나 컨텍스트 크기만 단계적으로 변화시키는 통제 실험이 추가된다면, 자원 비대칭이 탐지 성능에 미치는 순수한 영향을 훨씬 명확하게 규명할 수 있을 것이다.

**넷째, 구체적인 방어 기법의 구현과 검증은 남겨져 있다.** 저자들은 입력 가드에만 의존하는 전략의 한계를 짚고 출력 검사와 모델 자체의 안전 정렬을 병행할 필요성을 언급했으나, 이를 실제 방어 시스템으로 구현해 효과를 검증하는 단계까지는 나아가지 않았다. 다만 이 연구의 목적이 새로운 방어 기법 개발이 아니라 기존 방어 구조의 취약성을 실증하는 데 있다는 점을 감안하면, 이는 연구 자체의 결함이라기보다 후속 연구가 이어받아야 할 과제로 보는 편이 타당하다.

---

## 05. 확장 가능성과 후속 연구 구상

### 프롬프트 인젝션과 AI Agent 환경으로의 확장

자원 비대칭이 낳는 보안 위협은 탈옥에만 머무르지 않을 가능성이 크다. 특히 외부 문서나 웹페이지를 읽고 다양한 도구를 호출하는 **AI Agent** 환경은 본질적으로 방대한 컨텍스트를 다룬다. 만약 제한된 컨텍스트와 연산 예산을 쓰는 가드 모델이 이 방대한 입력을 검사하고, 훨씬 큰 문맥을 처리하는 에이전트가 실제 작업을 수행한다면 두 모델 사이의 의미 해석 격차가 프롬프트 인젝션 탐지 실패로 이어질 수 있다. 이는 현재 논문에서 직접 검증한 바는 아니지만, 자원 비대칭 관점에서 충분히 탐구해 볼 가치가 있는 연구 가설이다.

### 공간적 자원 비대칭 완화를 위한 분할 검사 비교 연구

가드의 컨텍스트 용량을 무작정 늘리지 않으면서 공간적 자원 비대칭을 완화하는 현실적인 대안으로, 긴 입력을 여러 조각으로 나누어 검사하는 **분할 기반 검사**를 떠올려 볼 수 있다. 그러나 입력의 각 부분을 빠짐없이 검사하는 것과 전체 문맥을 올바르게 이해하는 것은 전혀 다른 문제다. 입력을 쪼개는 과정에서 앞뒤 조각 사이의 의미적 연결이 끊어지거나, 전체 맥락 속에서만 드러나는 위험한 의도가 개별 조각에서는 무해하게 보일 수 있기 때문이다.

<figure style="margin: 0; text-align: center;">
  <img src="{{ '/assets/archive/controlled-release-prompting-review/whole-vs-split-checks.png' | relative_url }}"
       alt="A부터 D까지 전체 입력을 종합해 검사하는 방식과 네 부분을 개별 검사한 뒤 결과를 통합하는 방식의 비교"
       style="display: block; margin: 0 auto;">
  <figcaption style="margin-top: 0; font-size: 0.85em;">
    [그림 2] 전체 검사와 분할 검사의 차이
  </figcaption>
</figure>

이러한 문맥 손실과 판단 불일치가 실제로 어느 수준에서 발생하는지 확인하기 위해, 공개 가드 모델을 활용한 비교 실험을 구상해 보았다. 학부생 수준에서 새로운 의미 해석 알고리즘을 처음부터 설계하기보다는, 동일한 공개 가드 모델 위에서 대표적인 입력 분할 및 문맥 유지 기법을 구현하고 체계적으로 비교하는 접근이 현실적이다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 검사 방식 | 비교 목적 |
|---|---|
| **전체 입력 검사** | 비교 기준 수립 |
| **고정 길이 분할 검사** | 단순 분할에 따른 문맥 손실 확인 |
| **중첩 분할 검사** | 인접 문맥 공유에 따른 탐지 성능 변화 확인 |
| **의미 기반 분할 검사** | 문장 및 문단 단위 분할의 효과 확인 |
| **문맥 유지 기반 검사** | 이전 문맥 정보를 활용한 판단 일관성 개선 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 8] 입력 분할 방식별 비교 목적</figcaption>
</figure>

실험 설계에서는 앞서 4절에서 지적한 통제 조건을 반영하고자 한다. 전체 입력 검사의 결과 역시 항상 정답이라는 보장은 없으므로, 정답 레이블이 확보된 정상·위험 입력 데이터셋을 별도로 준비하고 분할 전략을 제외한 나머지 평가 조건과 가드 모델은 동일하게 유지한다.

평가 지표로는 정답 레이블 기준의 탐지 성능(Precision, Recall, F1-score, 오탐률)과 운영 비용(처리 시간, 메모리 사용량)을 함께 측정한다. 여기에 전체 입력 검사와 분할 검사 사이의 **판단 일치율**을 추가하되, 이를 의미적 일관성의 완전한 보증이 아니라 분할로 인해 판단이 얼마나 달라지는지를 가늠하는 대리 지표로 해석하며 불일치 사례의 특징을 정성적으로 분석할 계획이다.

이 구상을 하나의 프로젝트로 정리하면 다음과 같다.

- **연구 주제**: 제한된 컨텍스트 환경에서 의미적 일관성을 유지하는 분할 기반 프롬프트 검사 방법 연구

<figure class="review-table" markdown="1" style="text-align: center;">

| 구분 | 내용 |
|---|---|
| **연구 배경** | 가드와 본 모델 사이의 공간적 자원 비대칭 |
| **문제 정의** | 입력 분할 과정에서 발생하는 문맥 손실과 의미 해석의 불일치 |
| **연구 목표** | 분할 검사 시 발생하는 안전성 판단의 불일치 감소 |
| **연구 방법** | 기존 입력 분할 및 문맥 유지 방식 구현·비교 |
| **평가 지표** | Precision, Recall, F1-score, 판단 일치율, 처리 시간, 메모리 사용량 |
| **기대 효과** | 운영 효율성을 고려한 프롬프트 검사 방식 개선 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 9] 분할 검사 후속 연구 계획</figcaption>
</figure>

우선 공개 가드 모델의 실행 환경과 레이블링된 평가 데이터셋을 구축한 뒤, 위 다섯 가지 방식을 구현해 안전성 판단 결과와 자원 사용량의 트레이드오프를 비교할 예정이다. 궁극적으로는 가드 모델의 컨텍스트 크기를 무리하게 키우지 않으면서도 입력 전체의 의미를 일관되게 판별할 수 있는 방어 구조를 모색하고자 한다.

### 후속 탐구를 위한 참고 논문

앞선 분석과 후속 연구 구상을 구체화하기 위해 다음 네 편의 논문을 연계해 살펴볼 계획이다.

<figure class="review-table" markdown="1" style="text-align: center;">

| 논문 | 탐구 목적 |
|---|---|
| [On the Impossibility of Separating Intelligence from Judgment: The Computational Intractability of Filtering for AI Alignment][4] | 이번 논문의 직접적인 이론적 기반으로, 효율적인 입력 필터링의 한계가 어떤 암호학적·이론적 가정 아래 성립하는지 깊이 파악하기 위함 |
| [Llama Guard: LLM-based Input-Output Safeguard for Human-AI Conversations][5] | 입력 및 출력 가드가 안전성을 판단하는 구체적인 방식을 이해하고, 공개 가드 모델 기반 비교 실험의 토대로 삼기 위함 |
| [Constitutional Classifiers++: Efficient Production-Grade Defenses against Universal Jailbreaks][6] | 실제 서비스 환경에서 보안성과 운영 효율성을 함께 달성하려는 최신 방어 연구의 흐름을 확인하기 위함 |
| [StruQ: Defending Against Prompt Injection with Structured Queries][7] | 지시와 데이터를 구조적으로 분리하는 프롬프트 인젝션 방어 기법을 학습하고, 자원 비대칭 관점의 확장 가능성을 검토하기 위함 |

<figcaption style="margin-top: 0; font-size: 0.85em;">[표 10] 후속 연구 참고 논문</figcaption>
</figure>

---

## 참고문헌

1. Fairoze, J. et al. *Bypassing Prompt Guards in Production with Controlled-Release Prompting*. USENIX Security 2026. [공식 게재 페이지][1] · [정식 게재본][2] · [저자 공개본][3].
2. Ball, S. et al. *On the Impossibility of Separating Intelligence from Judgment: The Computational Intractability of Filtering for AI Alignment*. 2025. [arXiv][4].
3. Inan, H. et al. *Llama Guard: LLM-based Input-Output Safeguard for Human-AI Conversations*. 2023. [arXiv][5].
4. *Constitutional Classifiers++: Efficient Production-Grade Defenses against Universal Jailbreaks*. 2026. [arXiv][6].
5. Chen, S. et al. *StruQ: Defending Against Prompt Injection with Structured Queries*. USENIX Security 2025. [공식 게재 페이지][7].

[1]: https://www.usenix.org/conference/usenixsecurity26/presentation/fairoze
[2]: https://www.usenix.org/system/files/usenixsecurity26-fairoze.pdf
[3]: https://arxiv.org/html/2510.01529v4
[4]: https://arxiv.org/abs/2507.07341
[5]: https://arxiv.org/abs/2312.06674
[6]: https://arxiv.org/abs/2601.04603
[7]: https://www.usenix.org/conference/usenixsecurity25/presentation/chen-sizhe

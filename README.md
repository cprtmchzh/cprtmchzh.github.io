# Portfolio + Markdown Archive

아이보리 기반의 미니멀한 개인 포트폴리오입니다. Home / Projects / Archive / About과 공통 Markdown 상세 페이지를 제공합니다.

## 남긴 초기 콘텐츠

- Projects 1개 (작성 예시): `_data/projects.yml` + `_projects/python-automation.md` (파일 정리 CLI 설계 노트)
- Archive 1개: `_posts/2026-10-23-tech-writing-note-template.md` (기술문서 작성법)
- 6개 Archive 카테고리는 글 수가 0개여도 그대로 유지됩니다.
- 공개 화면의 예시 배지·시안 안내문·빈 관련글 안내문은 제거했습니다.

새 글이 필요하다면 `_templates/`의 Markdown 양식을 복사해 추가하세요. 삭제된 글이 기존 GitHub 저장소에 남아 있다면, 해당 Markdown 파일도 GitHub에서 삭제해야 실제 배포 사이트에서 사라집니다.

## 글 추가 / 수정

1. `_templates/POST_TEMPLATE.md`를 복사하여 `_posts/YYYY-MM-DD-title.md`로 저장합니다.
2. `category_slug` 중 하나를 선택합니다: `development`, `ctf-wargame`, `bug-bounty`, `technical-writing`, `research-conference`, `achievements`.
3. Markdown 내용은 `##`, `###`, 코드 블록, 표, 이미지로 작성합니다. 오른쪽 목차가 자동 생성됩니다.
4. GitHub에 커밋하면 Jekyll이 새 페이지를 빌드합니다.

프로젝트를 추가하려면 `_data/projects.yml`에 카드 정보를 추가하고 `_projects/ID.md`를 만듭니다. `detail_url`과 `permalink`를 일치시키세요.

이미지·PDF는 `assets/uploads/`에 올리고 Markdown에서 `{{ '/assets/uploads/파일명' | relative_url }}`을 참조할 수 있습니다.

## 사이트 설정과 디자인

- `_data/profile.yml` — 이름, 프로필, 관심 분야, GitHub
- `_data/projects.yml` — 프로젝트 목록
- `_data/categories.yml` — 6개 아카이브 카테고리
- `_layouts/article.html` — Projects/Archive 공통 상세 페이지
- `assets/css/ui-components.css` — 프로젝트 카드와 우측 박스의 공통 스타일
- `assets/css/post-minimal.css` — Markdown 본문 스타일
- `assets/js/post-minimal.js` — 자동 목차 및 위치 추적
- `assets/css/list-common.css` — Projects/Archive 공통 기초 스타일

목록에서 **필터된 항목이 6개 이상이면 내부 스크롤**이 적용됩니다. 게시글은 같은 카테고리 목록으로 돌아가거나 `/archive/index.html`을 열 수 있습니다.

## GitHub Pages 배포

1. ZIP 내용 전체를 저장소 루트에 올리세요.
2. 개인 저장소 이름이 `username.github.io`라면 `_config.yml`의 `baseurl: ""`를 유지하세요. 프로젝트 저장소라면 `baseurl: "/저장소명"`으로 지정하세요.
3. GitHub Settings → Pages → Deploy from a branch → main / (root)를 선택하세요.
4. 기존 GitHub 저장소에서 삭제된 파일은 **GitHub에서도 직접 삭제**해야 합니다. ZIP을 덮어올리는 것만으로는 삭제되지 않습니다.

GitHub Pages는 작성자가 GitHub에 커밋하는 방식으로 게시하며, 방문자 업로드 기능은 없습니다. 실제 이력이나 성과는 직접 확인 가능한 정보로 작성하세요.

## 목록 빈 상태 및 구분선 수정

- Projects 카드 마지막 행과 하단 푸터 구분선 간 여백 확보 (PC 40px / 모바일 28px)
- Projects 필터 결과 0개: 목록 중앙에 `No projects found.`
- Archive 카테고리/검색 결과 0개: 목록 중앙에 `No posts found.`
- 기존 카드 크기, 6개 이상 목록 내부 스크롤 조건, 상세 페이지는 그대로 유지

## Projects 카드 Hover 애니메이션

프로젝트 카드의 기존 위로 2px 이동하는 Hover 효과는 유지합니다. 목록 내부에 상단 여백 14px을 확보해 첫 번째 줄의 카드와 그림자가 상단 영역에 닿지 않도록 했습니다. 6개 이상 표시되면 목록 내부 스크롤을 사용합니다.

## Projects / Archive 목록 영역 높이 통일 (2026-10-31)

Projects와 Archive의 목록 시작/끝 구분선 높이를 통일했습니다. 데스크톱 및 태블릿(가로 701px 이상)에서 헤더 영역은 87px, 목록 콘텐츠 영역은 660px을 기준으로 하며, Projects는 최대 620px, Archive 게시글 목록은 최대 542px까지 내부 스크롤 영역을 확장합니다. 필터 결과가 6개 이상일 때만 내부 스크롤이 활성화되고, 5개 이하는 표시 영역을 유지합니다. 모바일에서는 화면에 맞춰 자연스러운 높이를 사용합니다. 크기는 `assets/css/list-common.css`의 `--catalog-*` 변수에서 조정할 수 있습니다.

## 우측 상세 목차 / 관련 콘텐츠 (2026-10-31)

- Projects 및 Archive 상세 페이지는 공통 `article.html`과 `post-minimal.css`를 공유합니다.
- 우측 목차와 관련 콘텐츠 글꼴을 키워 가독성을 개선했습니다.
- 관련 콘텐츠는 같은 카테고리의 다른 항목 중 최대 5개를 글머리표 목록으로 표시합니다.
- 현재 공개 예시는 Projects 1개, Archive 1개뿐이라 관련 콘텐츠 목록은 비어 있습니다. 새 항목을 추가하면 자동으로 나타납니다.
- sticky 박스, 본문 스크롤에 따른 목차 강조, 모바일에서 관련 글을 본문 아래 배치하는 동작은 유지합니다.

## 전구 다크모드 버튼

메인 페이지의 중앙 카드 위에 있는 박스 없는 전구 아이콘으로 라이트/다크 모드를 전환할 수 있습니다. 다른 페이지에서는 버튼이 보이지 않지만 선택된 테마는 유지됩니다.
테마는 같은 탭에서만 기억되며, 새 세션은 라이트모드로 시작합니다. About 사진은 테마에 따라 자동으로 변경됩니다.
다크모드 사진은 `assets/uploads/cprtmchzh-profile-dark.png`, 라이트모드 사진은 `assets/uploads/cprtmchzh-profile.png` 입니다.
버튼과 색상은 `assets/css/theme-switch.css`, 상태 저장 및 전환은 `assets/js/theme-switch.js`에서 관리합니다.
스크립트와 스타일은 `_layouts/`의 각 레이아웃에서 불러오므로 Markdown 상세 페이지에도 자동 적용됩니다.


## 다크모드 개선 (2026-10-31)
- 메인 페이지 중앙 3개 카드 위에 작고 단순한 전구 버튼을 배치했습니다.
- 다크모드는 딥 네이비 배경과 청록·보라·핑크 네온 포인트로 구성했습니다.
- 라이트모드는 기존 아이보리·노란색, 다크모드는 카드별 네온색 Hover를 사용합니다.
- 기존 페이지 레이아웃, 프로필 이미지 전환, Markdown 렌더링을 유지합니다.
- 테마 설정은 탭의 sessionStorage에 저장됩니다 (새 세션은 라이트모드).

## 홈 테마 버튼
메인 화면의 중앙 박스 상단에 테두리 없는 전구 선 아이콘이 있습니다. 다른 페이지에도 테마가 적용되며 버튼은 메인 화면에만 표시됩니다. 자세한 내용은 `THEME_V3.md`를 참고하세요.

## 메인 전구의 원형 테마 전환

전구 Hover 시 반지름 208px(지름 416px)의 원 안에 반대 테마가 표시되고, 클릭 시 원이 전체 화면으로 확장됩니다. 마우스 Hover는 기존 전구 버튼 진입/이탈 시에만 반응하며, 빠른 커서 경로 추적이나 280ms 유지 효과는 사용하지 않습니다. 세부 구현과 수정 위치는 `THEME_CIRCLE_REVEAL.md`를 참고하세요.


### 테마 전환 버그 수정
- 전구 클릭 순간 선택 테마를 `sessionStorage`에 먼저 기록합니다. 원형 확산(680ms) 중 다른 페이지로 이동해도 선택한 테마가 적용됩니다.
- Hover 원이 커지는 도중 커서가 벗어나도 실제 진행 중인 원의 크기부터 줄어들어 갑자기 208px로 뛰지 않습니다.
- 클릭 중에는 Hover 종료가 원형 확산을 취소하지 않습니다. 기본 라이트모드와 208px Hover 반지름은 그대로입니다.

## 메인 Hover 색상 조정 (2026-10-31)

라이트모드 Home 카드의 Hover만 기존 파스텔보다 진하게 수정했습니다: Projects `#CDE9DD`, Archive `#DFD1F1`, About `#F3D4E1`. 기존 로딩 모션·다크 네온·Projects의 Claude 베이지 카드 Hover는 유지합니다.

## 애니메이션 속도 조정 (2026-10-31)

- 전체 페이지 순차 진입 시간·간격 약 28% 단축 (`assets/css/entrance-motion.css`).
- 카드, 필터, 목차, 전구 등 Hover/전환 CSS 약 25% 단축. 기존 곡선·색상·2/3px 상승값 유지.
- 전구 원형 클릭 확산: 680ms → 500ms, Hover 원 펼침 200ms → 150ms, 닫힘 180ms → 135ms. 반지름 208px 유지.
- 전환 테마는 클릭 순간 `sessionStorage`에 저장하며, 커서 이탈 시 원 점프 방지 유지.
- `prefers-reduced-motion` 지원 유지.


## 2026-10-31 · 빠른 모션 + 또렷한 홈 Hover

- Home (라이트) Hover: Projects `#B5EED0`, Archive `#D8B9F8`, About `#FBBFD5`. 기본 카드 텍스트 색상 `#272722`을 Hover에서도 유지.
- Home (다크) Hover도 기존 텍스트 색상을 유지하면서 네온 테두리와 광원 효과는 그대로 사용.
- 페이지 진입 애니메이션/일반 Hover 속도 약 25~30% 단축; 전구 클릭 원형 확산 500ms.
- 기존 Projects Claude 베이지 Hover, 다크 네온 테마, 클릭 직후 테마 세션 저장, 최소 움직임 지원 유지.

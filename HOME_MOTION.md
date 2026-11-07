# 메인 카드 Hover · 페이지 진입 모션

- Light: Projects `#CDE9DD` (mint), Archive `#DFD1F1` (lavender), About `#F3D4E1` (rose).
- Dark: 기존 청록·보라·핑크 네온 스타일 그대로 유지.
- 기본 카드 색, 3px Home Hover, Projects 2px Hover, 필터, sticky 목차, 전구 원형 테마 전환 변경 없음.
- 진입 효과: CSS `assets/css/entrance-motion.css`로 통합. 페이지별 순차 페이드+12px 상승 (약 0.35~0.4초).
- `prefers-reduced-motion: reduce`에서는 진입 효과 완전 비활성화.
- 새로운 Markdown 게시물과 프로젝트도 기존 레이아웃 클래스를 사용하면 진입 모션 자동 적용.

- 빠른 모션 버전: 진입·스태거 약 28% 단축, 일반 Hover 약 25% 단축, 전구 원형 확산 500ms.

현재 라이트 Home Hover 색: mint `#B5EED0`, lavender `#D8B9F8`, rose `#FBBFD5`. Hover 시 글자색 고정(다크모드 포함).

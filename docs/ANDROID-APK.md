# Android 설치형 카드 게임 빌드 (개발 후보)

현재 Android 소스와 게임 파일이 준비되어 있지만 실제 Android SDK가 없어서 APK 컴파일, 서명, 설치, 실기는 완료되지 않았습니다. 이 ZIP은 APK가 아닙니다. 카드 및 AI 원본은 유지됩니다. 온라인 계정이나 Render/Supabase 서버는 사용하지 않습니다.

## 빌드 준비

1. Windows PC에서 ZIP을 풉니다. Node.js 24 및 Android Studio/SDK가 필요합니다. Android Studio [SDK Manager](https://developer.android.com/studio/intro/update#sdk-manager)에서 Android SDK Platform API 34 이상과 SDK Build-Tools를 설치합니다. JDK 17 이상(예: Android Studio 기본 JBR)을 사용합니다.
2. `ANDROID_SDK_ROOT` 또는 `ANDROID_HOME`을 실제 SDK 설치 위치로 설정하세요. Windows 기본 SDK/JBR 위치는 `build-android-apk.cmd`가 존재 여부를 확인하여 선택합니다.
3. 터미널에서 `node apps/cli/build-android.mjs --check`를 실행하면 SDK와 JDK 도구를 검사합니다. 저장된 독립 HTML을 그대로 패키징하려면 `node apps/cli/build-android.mjs --prepare`를 실행합니다. 새 개발 소스에서 HTML을 다시 빌드하려면 `npm ci` 후 `npm run android:prepare`를 실행합니다.

## 최초 개인 서명 키와 APK

- 업데이트에 같은 앱 ID(`com.cardduel.solo`)와 서명 키가 필요합니다. **최초 한 번만 본인 PC에서 개인 키스토어를 만들고 별도로 안전하게 보관하세요.** 키스토어·비밀번호는 채팅이나 프로젝트 ZIP에 넣지 마세요. 기존 키가 있다면 새 키를 만들지 않습니다.
- 예시 명령: `keytool -genkeypair -v -keystore card-duel-private.jks -alias card-duel -keyalg RSA -keysize 3072 -validity 10000` (기존 파일이 없고 본인이 관리하는 별도 폴더에서 실행). 비밀번호는 터미널에서 직접 입력합니다.
- Windows 프로젝트 폴더에서 `build-android-apk.cmd "D:\개인키폴더\card-duel-private.jks" card-duel` 또는 `npm run android:build -- --keystore "D:\개인키폴더\card-duel-private.jks" --alias card-duel`을 실행합니다. 서명 과정은 비밀번호를 터미널에 요청합니다.
- 빌드 성공 시 `dist/android/card-duel-v0.102.0.apk`, `apk-sha256.txt`, `apk-info.json`이 생성됩니다. 서명 검증과 ZIP 정렬 검사가 통과해야 APK를 출력합니다. 실제 빌드 과정 및 서명은 아직 이 환경에서 실행되지 않았습니다. PWA 로컬 저장 우선으로 Android 제작은 보류합니다.

## Galaxy S24 설치와 검증 (미완료)

- 신뢰하는 본인 빌드 APK만 휴대폰에 옮겨 설치합니다. 강제 보안 설정 해제나 출처 불명의 APK 설치를 권장하지 않습니다.
- 첫 실행에서 유저 모드·25랭크·자동 저장을 확인하고 Wi-Fi·모바일 데이터 차단 후 대전, 앱 종료/재실행, 이어하기를 확인합니다. Android System WebView가 최신 지원 버전이어야 합니다.
- 성장 및 덱 백업 버튼은 Android 시스템 파일 선택기를 통해 JSON을 저장하거나 읽습니다. 파일 선택 취소/쓰기 오류는 성공으로 처리하지 않습니다. PC에서 내보낸 성장 백업은 새 앱 성장 기록에만 복원할 수 있으며 덱은 기존 덱을 덮어쓰지 않고 추가됩니다.
- PC 브라우저 저장소와 Android 앱의 저장소는 별개입니다. 자동 계정 동기화는 추후 온라인 기능입니다. 앱을 삭제하거나 앱 데이터를 초기화하면 게임 진행이 사라질 수 있으므로 반드시 별도 JSON 백업을 유지하세요.
- APK 패치는 동일 앱 ID, 동일 서명 키, 이전보다 높은 versionCode를 사용합니다. 기존 앱을 삭제하지 않고 업데이트하는 것이 원칙입니다. 카드 데이터가 바뀌는 패치 전에는 진행 중인 랭크 경기를 완료하고 성장/덱을 백업합니다. 버전 간 실제 업데이트 및 저장 유지 시험은 앞으로 수행할 항목입니다.

## 구현 구조 / 확인 범위

- 게임은 APK에 포함된 단일 HTML이며 고정 HTTPS base URL을 통해 앱 내부 WebView 저장소를 사용합니다. 네트워크와 파일/콘텐츠 접근을 차단하고 백업에는 명시적으로 선택한 시스템 문서만 사용합니다. CSP로 외부 네트워크·프레임·폼을 차단합니다.
- `npm run test:android`는 백업 JS 브리지, 번들 해시·Manifest·SDK 사전 검사 및 순수 Java 백업 검사를 실행합니다. Android Activity의 실제 컴파일과 WebView 동작을 대체하지 않습니다.
- 공식 참고: [Android 앱 내부 콘텐츠](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content), [시스템 파일 선택기](https://developer.android.com/training/data-storage/shared/documents-files), [AAPT2](https://developer.android.com/tools/aapt2), [APK 서명 및 명령행 빌드](https://developer.android.com/build/building-cmdline).

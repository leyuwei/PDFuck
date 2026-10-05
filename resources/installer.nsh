!include nsDialogs.nsh

!macro customWelcomePage
  Page custom PDFuckInstallationStatus
!macroend

!macro customHeader
!ifndef BUILD_UNINSTALLER
LangString PDFuckInstallTitle ${LANG_SIMPCHINESE} "安装 PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_ENGLISH} "Install PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_JAPANESE} "PDFuck ${VERSION} のインストール"
LangString PDFuckInstallTitle ${LANG_RUSSIAN} "Установка PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_SPANISHINTERNATIONAL} "Instalar PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_FRENCH} "Installer PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_GERMAN} "PDFuck ${VERSION} installieren"
LangString PDFuckInstallTitle ${LANG_PORTUGUESEBR} "Instalar PDFuck ${VERSION}"
LangString PDFuckInstallTitle ${LANG_KOREAN} "PDFuck ${VERSION} 설치"
LangString PDFuckInstallTitle ${LANG_ARABIC} "تثبيت PDFuck ${VERSION}"
LangString PDFuckExisting ${LANG_SIMPCHINESE} "检测到已安装 PDFuck $R0。$\r$\n位置：$R1$\r$\n$\r$\n继续将更新此安装。已有用户设置将保留。"
LangString PDFuckExisting ${LANG_ENGLISH} "PDFuck $R0 is already installed.$\r$\nLocation: $R1$\r$\n$\r$\nContinue to update this installation. Your preferences will be retained."
LangString PDFuckExisting ${LANG_JAPANESE} "PDFuck $R0 はインストール済みです。$\r$\n場所: $R1$\r$\n$\r$\n続行すると更新されます。設定は保持されます。"
LangString PDFuckExisting ${LANG_RUSSIAN} "PDFuck $R0 уже установлен.$\r$\nПуть: $R1$\r$\n$\r$\nПродолжение обновит установку. Настройки сохранятся."
LangString PDFuckExisting ${LANG_SPANISHINTERNATIONAL} "PDFuck $R0 ya está instalado.$\r$\nUbicación: $R1$\r$\n$\r$\nContinúe para actualizarlo. Se conservarán sus preferencias."
LangString PDFuckExisting ${LANG_FRENCH} "PDFuck $R0 est déjà installé.$\r$\nEmplacement : $R1$\r$\n$\r$\nContinuer mettra à jour cette installation et conservera vos préférences."
LangString PDFuckExisting ${LANG_GERMAN} "PDFuck $R0 ist bereits installiert.$\r$\nPfad: $R1$\r$\n$\r$\nFortfahren aktualisiert diese Installation. Einstellungen bleiben erhalten."
LangString PDFuckExisting ${LANG_PORTUGUESEBR} "PDFuck $R0 já está instalado.$\r$\nLocal: $R1$\r$\n$\r$\nContinue para atualizar. Suas preferências serão mantidas."
LangString PDFuckExisting ${LANG_KOREAN} "PDFuck $R0이 이미 설치되어 있습니다.$\r$\n위치: $R1$\r$\n$\r$\n계속하면 업데이트됩니다. 사용자 설정은 유지됩니다."
LangString PDFuckExisting ${LANG_ARABIC} "PDFuck $R0 مثبت بالفعل.$\r$\nالموقع: $R1$\r$\n$\r$\nالمتابعة تحدّث هذا التثبيت مع الاحتفاظ بالتفضيلات."
LangString PDFuckFresh ${LANG_SIMPCHINESE} "未检测到已有安装。$\r$\n将安装 PDFuck ${VERSION}。"
LangString PDFuckFresh ${LANG_ENGLISH} "No existing installation was found.$\r$\nPDFuck ${VERSION} will be installed."
LangString PDFuckFresh ${LANG_JAPANESE} "既存のインストールは見つかりません。$\r$\nPDFuck ${VERSION} をインストールします。"
LangString PDFuckFresh ${LANG_RUSSIAN} "Предыдущая установка не найдена.$\r$\nБудет установлен PDFuck ${VERSION}."
LangString PDFuckFresh ${LANG_SPANISHINTERNATIONAL} "No se encontró una instalación previa.$\r$\nSe instalará PDFuck ${VERSION}."
LangString PDFuckFresh ${LANG_FRENCH} "Aucune installation existante trouvée.$\r$\nPDFuck ${VERSION} sera installé."
LangString PDFuckFresh ${LANG_GERMAN} "Keine vorhandene Installation gefunden.$\r$\nPDFuck ${VERSION} wird installiert."
LangString PDFuckFresh ${LANG_PORTUGUESEBR} "Nenhuma instalação existente encontrada.$\r$\nPDFuck ${VERSION} será instalado."
LangString PDFuckFresh ${LANG_KOREAN} "기존 설치를 찾지 못했습니다.$\r$\nPDFuck ${VERSION}을 설치합니다."
LangString PDFuckFresh ${LANG_ARABIC} "لم يُعثر على تثبيت سابق.$\r$\nسيتم تثبيت PDFuck ${VERSION}."

Function PDFuckInstallationStatus
  !insertmacro MUI_HEADER_TEXT "$(PDFuckInstallTitle)" ""
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  # Read both supported scopes using electron-builder's stable application registry keys.
  ReadRegStr $R1 HKLM "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $R0 HKLM "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${If} $R1 != ""
    IfFileExists "$R1\${APP_EXECUTABLE_FILENAME}" existing 0
  ${EndIf}
  ReadRegStr $R1 HKCU "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ReadRegStr $R0 HKCU "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ${If} $R1 != ""
    IfFileExists "$R1\${APP_EXECUTABLE_FILENAME}" existing missing
  ${EndIf}
  Goto missing
  existing:
    ${NSD_CreateLabel} 0 20u 100% 90u "$(PDFuckExisting)"
    Goto statusReady
  missing:
    ${NSD_CreateLabel} 0 20u 100% 90u "$(PDFuckFresh)"
  statusReady:
  Pop $0
  nsDialogs::Show
FunctionEnd
!endif
!macroend

; EmDy — ajouts à l'installateur NSIS de Tauri.
; La page « Options » est déclarée dans installer.nsi (modèle Tauri 2.12.5 personnalisé).
; Les choix sont appliqués par l'exe lui-même (emdy.exe --configure), avec le même code que
; la fenêtre Paramètres de l'application.

!include nsDialogs.nsh

Var EmdyMd
Var EmdyFolder
Var EmdyMdBox
Var EmdyFolderBox

!macro NSIS_HOOK_POSTINSTALL
  ; Installation silencieuse (winget, /S) : on ne touche pas à Windows sans demander.
  ; La fenêtre de configuration s'ouvrira au premier démarrage d'EmDy.
  ${IfNot} ${Silent}
    !insertmacro EmdyConfigure
  ${EndIf}
!macroend

!macro EmdyConfigure
  ${If} $EmdyMd == ""
    StrCpy $EmdyMd 1
  ${EndIf}
  ${If} $EmdyFolder == ""
    StrCpy $EmdyFolder 1
  ${EndIf}
  StrCpy $R9 "en"
  ${If} $LANGUAGE == 1036
    StrCpy $R9 "fr"
  ${EndIf}
  nsExec::Exec '"$INSTDIR\${MAINBINARYNAME}.exe" --configure --lang=$R9 --md=$EmdyMd --folder=$EmdyFolder'
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Retire les associations et les menus contextuels.
  nsExec::Exec '"$INSTDIR\${MAINBINARYNAME}.exe" --unregister'
  Pop $0
!macroend

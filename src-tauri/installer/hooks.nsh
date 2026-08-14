; drift — custom NSIS installer hooks
;
; Wired in via bundle.windows.nsis.installerHooks in tauri.conf.json. This file
; is !included at the top of Tauri's generated installer.nsi, which then calls
; each macro at a fixed point in the flow:
;
;   NSIS_HOOK_PREINSTALL     before files are copied / registry is written
;   NSIS_HOOK_POSTINSTALL    after files, registry keys and shortcuts exist
;   NSIS_HOOK_PREUNINSTALL   before files are removed
;   NSIS_HOOK_POSTUNINSTALL  after everything has been removed
;
; Deliberately NOT reimplemented here, because Tauri's template already does it:
; closing a running drift.exe, Add/Remove Programs metadata, EstimatedSize,
; homepage/help links, start menu and desktop shortcuts, WebView2 bootstrapping.
;
; Everything below is silent-install safe: nothing prompts when /S is passed.

!include "LogicLib.nsh"

!define DRIFT_APPDATA_DIR "drift"          ; %APPDATA%\drift — settings.json, session.json
!define DRIFT_REG_KEY     "Software\drift"

; Roaming AppData of the *invoking user*, resolved without touching the shell
; var context (which the template owns, and which points at C:\ProgramData
; during a per-machine install).
Var DriftConfigDir

!macro DriftResolveConfigDir
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" "AppData"
  ${If} $0 == ""
    StrCpy $0 "$APPDATA"
  ${EndIf}
  StrCpy $DriftConfigDir "$0\${DRIFT_APPDATA_DIR}"
!macroend

; ---------------------------------------------------------------------------
; Install
; ---------------------------------------------------------------------------

!macro NSIS_HOOK_PREINSTALL
  ; Upgrade safety net. drift keeps the server URL, username, Discord and
  ; Last.fm settings in settings.json and the restored queue in session.json.
  ; Keep one rolling backup so a bad upgrade can never lose the connection setup.
  !insertmacro DriftResolveConfigDir

  ${If} ${FileExists} "$DriftConfigDir\settings.json"
    DetailPrint "Backing up drift settings..."
    CopyFiles /SILENT "$DriftConfigDir\settings.json" "$DriftConfigDir\settings.json.bak"
  ${EndIf}
  ${If} ${FileExists} "$DriftConfigDir\session.json"
    CopyFiles /SILENT "$DriftConfigDir\session.json" "$DriftConfigDir\session.json.bak"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Stable, install-mode agnostic key so tooling (and drift itself) can find the
  ; install without parsing the Uninstall hive.
  WriteRegStr SHCTX "${DRIFT_REG_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "${DRIFT_REG_KEY}" "Version" "${VERSION}"
!macroend

; ---------------------------------------------------------------------------
; Uninstall
; ---------------------------------------------------------------------------

!macro NSIS_HOOK_PREUNINSTALL
  ; Nothing extra needed — the template already stops a running drift.exe.
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "${DRIFT_REG_KEY}"

  !insertmacro DriftResolveConfigDir

  ${If} ${FileExists} "$DriftConfigDir\*.*"
    ${If} ${Silent}
      ; Scripted uninstalls always keep user data; wiping it unprompted would
      ; break the common "uninstall, then reinstall a newer build" flow.
      DetailPrint "Keeping drift settings in $DriftConfigDir"
    ${Else}
      MessageBox MB_YESNO|MB_ICONQUESTION \
        "Also remove your drift settings, saved server and playback session?$\r$\n$\r$\n\
$DriftConfigDir$\r$\n$\r$\n\
Your password is stored in Windows Credential Manager and is left alone either way." \
        /SD IDNO IDYES DriftRemoveUserData IDNO DriftKeepUserData
      DriftRemoveUserData:
        RMDir /r "$DriftConfigDir"
        DetailPrint "Removed drift settings."
      DriftKeepUserData:
    ${EndIf}
  ${EndIf}
!macroend

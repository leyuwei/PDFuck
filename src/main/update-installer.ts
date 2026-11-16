import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { dirname,join } from 'node:path'
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'"
export function macUpdateScript(installer:string,target:string,version:string,pid:number,arch:string,scriptPath:string,failureMessage='Installation failed. The downloaded installer is retained.'):string {
 if(!/^\d+(\.\d+){1,3}$/.test(version)||!Number.isSafeInteger(pid)||!['arm64','x64'].includes(arch)||!target.endsWith('.app'))throw Error('updates.unavailable')
 const elevate=JSON.stringify(`/bin/bash ${quote(scriptPath)} --elevated`)
 return `#!/bin/bash
set -euo pipefail
archive=${quote(installer)}
target=${quote(target)}
mount=''
backup=''
stage=''
mode="\u0024{1:-}"
cleanup() {
 code=$?
 if [[ -n "$mount" ]]; then /usr/bin/hdiutil detach "$mount" -quiet || true; /bin/rmdir "$mount" || true; fi
 if [[ $code != 0 ]]; then
  if [[ -d "$backup" && ! -d "$target" ]]; then /bin/mv "$backup" "$target"; fi
  if [[ -d "$stage" ]]; then /bin/rm -rf "$stage"; fi
  if [[ "$mode" != --elevated ]]; then
   /usr/bin/osascript -e ${quote('display alert "PDFuck" message '+JSON.stringify(failureMessage))} || true
   /usr/bin/open "$target" || true
  fi
 fi
}
trap cleanup EXIT
while /bin/kill -0 ${pid} 2>/dev/null; do /bin/sleep 1; done
if [[ ! -w "$(/usr/bin/dirname "$target")" && "$mode" != --elevated ]]; then
 /usr/bin/osascript -e ${quote('do shell script '+elevate+' with administrator privileges')}
 /usr/bin/open "$target"
 exit 0
fi
mount=$(/usr/bin/mktemp -d)
backup="$target.previous-$$"
stage="$target.update-$$"
/usr/bin/hdiutil attach "$archive" -readonly -nobrowse -mountpoint "$mount"
source="$mount/PDFuck.app"
[[ "$('/usr/libexec/PlistBuddy' -c 'Print :CFBundleIdentifier' "$source/Contents/Info.plist")" == cn.pdfuck.app ]]
[[ "$('/usr/libexec/PlistBuddy' -c 'Print :CFBundleShortVersionString' "$source/Contents/Info.plist")" == ${quote(version)} ]]
/usr/bin/codesign --verify --deep --strict "$source"
/usr/bin/lipo -archs "$source/Contents/MacOS/PDFuck" | /usr/bin/grep -qw ${arch==='arm64'?'arm64':'x86_64'}
/usr/bin/ditto "$source" "$stage"
if [[ -d "$target" ]]; then /bin/mv "$target" "$backup"; fi
/bin/mv "$stage" "$target"
if [[ -d "$backup" ]]; then /bin/rm -rf "$backup"; fi
if [[ "$mode" != --elevated ]]; then /usr/bin/open "$target"; fi
`
}
export async function prepareUpdateLaunch(root:string,file:string,version:string,executable:string,platform:string,arch:string,failureMessage:string):Promise<()=>void>{
 if(platform==='win32')return()=>{spawn(file,[],{detached:true,stdio:'ignore'}).unref()}
 if(platform!=='darwin')throw Error('updates.unavailable')
 const running=dirname(dirname(dirname(executable))),target=running.startsWith('/Volumes/')?'/Applications/PDFuck.app':running
 const script=join(root,'install-update.sh');await writeFile(script,macUpdateScript(file,target,version,process.pid,arch,script,failureMessage),{mode:0o700})
 return()=>{spawn('/bin/bash',[script],{detached:true,stdio:'ignore',cwd:root}).unref()}
}

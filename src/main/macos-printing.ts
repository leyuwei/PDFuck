import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PrintPdfOptions } from '../shared/contracts'
import { buildMacosCupsPrintArguments, type CupsDuplexOption } from './print-settings'

export function cupsSupportsUrf(ppd: string): boolean {
  return /^\*cupsFilter2?:\s*"image\/urf\s/im.test(ppd)
}

/** AirPrint's zero-cost PDF pass-through reaches firmware; URF is rasterized by macOS instead. */
export async function prepareMacosPrinterData(pdfPath: string, rasterPath: string, printer: string, options: PrintPdfOptions, duplex: CupsDuplexOption | null): Promise<string> {
  const ppdPath=join('/etc/cups/ppd',basename(printer)+'.ppd')
  const ppd=await readFile(ppdPath,'utf8').catch(()=> '')
  if(!cupsSupportsUrf(ppd))return pdfPath
  const job=buildMacosCupsPrintArguments(options,printer,pdfPath,duplex)
  const flags:string[]=[]
  for(let i=0;i<job.length;i++) if(job[i]==='-o') { flags.push('-o',job[++i]) }
  const {stdout}=await promisify(execFile)('/usr/sbin/cupsfilter',['-p',ppdPath,'-i','application/pdf','-m','image/urf',...flags,'-o',`Resolution=${options.quality}dpi`,pdfPath],{encoding:'buffer',timeout:120000,maxBuffer:128*1024*1024})
  if(stdout.subarray(0,8).toString('ascii')!=='UNIRAST\0')throw new Error('macOS did not produce valid AirPrint raster data.')
  await writeFile(rasterPath,stdout,{mode:0o600})
  return rasterPath
}

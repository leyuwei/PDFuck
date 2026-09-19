import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PdfSecurityInfo, PdfSignatureInfo } from '../../../shared/contracts'
import { ui } from '../lib/i18n'
import { ScrollWindow } from './ScrollWindow'

function signatureLabel(signature: PdfSignatureInfo): string {
  return ui(signature.status === 'valid' ? 'ui.signatureValid' : signature.status === 'invalid' ? 'ui.signatureInvalid' : signature.status === 'unsigned' ? 'ui.signatureUnsigned' : 'ui.signatureUnsupported')
}

function shortDate(value?: string): string { return value?.slice(0, 10) || '—' }

export function PdfSecurityNotice({ security, busy, onForceEditableCopy }: { security: PdfSecurityInfo; busy: boolean; onForceEditableCopy(): void }) {
  const [open, setOpen] = useState(false)
  const signed = security.signatures.length > 0
  const summary = [security.encrypted && ui('ui.encryptedRestrictionNotice'), signed && ui(security.changedAfterSigning ? 'ui.signatureAlreadyInvalidated' : 'ui.signedPdfNotice')].filter(Boolean).join(' ')
  const permissions = security.permissions && [
    ['ui.permissionPrint', security.permissions.print], ['ui.permissionCopy', security.permissions.copy],
    ['ui.permissionModify', security.permissions.modify], ['ui.permissionAnnotate', security.permissions.annotate]
  ] as const
  return <>
    {createPortal(<aside className="document-security-banner" role="status"><span aria-hidden="true">◆</span><div><b>{ui('ui.protectedOrSignedPdf')}</b><small>{summary}</small></div><div className="document-security-actions">{signed && <button type="button" onClick={() => setOpen(true)}>{ui('ui.verifyDigitalSignatures')}</button>}{security.encrypted && <button type="button" className="primary" disabled={busy} onClick={onForceEditableCopy}>{busy ? ui('ui.creatingEditableCopy') : ui('ui.forceEditableCopy')}</button>}</div></aside>, document.querySelector('.document-area') || document.body)}
    {open && createPortal(<div className="modal-backdrop security-details-backdrop"><ScrollWindow className="modal security-details-dialog" role="dialog" aria-modal="true" aria-labelledby="security-details-title">
      <header><div><small>{ui('ui.protectedOrSignedPdf')}</small><h2 id="security-details-title">{ui('ui.documentSecurityDetails')}</h2></div><button type="button" aria-label={ui('ui.close')} title={ui('ui.close')} onClick={() => setOpen(false)}>×</button></header>
      {security.changedAfterSigning && <p className="security-changed-warning">{ui('ui.signatureAlreadyInvalidated')}</p>}
      {permissions && <section className="security-permissions"><h3>{ui('ui.permissionSummary')}</h3><div>{permissions.map(([label, allowed]) => <span className={allowed ? 'allowed' : 'restricted'} key={label}><b>{ui(label)}</b><small>{ui(allowed ? 'ui.permissionAllowed' : 'ui.permissionDenied')}</small></span>)}</div></section>}
      <div className="signature-list">{security.signatures.map((signature, index) => <section className={`signature-card ${signature.status}`} key={index}><header><b>{signatureLabel(signature)}</b><span>{index + 1}</span></header>{signature.signer && <p><span>{ui('ui.signer')}</span><b>{signature.signer}</b></p>}{signature.issuer && <p><span>{ui('ui.certificateIssuer')}</span><b>{signature.issuer}</b></p>}{(signature.validFrom || signature.validTo) && <p><span>{ui('ui.certificateValidity')}</span><b>{shortDate(signature.validFrom)} — {shortDate(signature.validTo)}</b></p>}<small>{ui(signature.coversWholeDocument ? 'ui.signatureCoversWholeFile' : 'ui.signaturePartialFile')}</small></section>)}</div>
      <p className="security-trust-note">{ui('ui.signatureTrustNotice')}</p>
      <div className="modal-actions"><button type="button" className="primary" onClick={() => setOpen(false)}>{ui('ui.close')}</button></div>
    </ScrollWindow></div>, document.body)}
  </>
}

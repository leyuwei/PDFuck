// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest'
import { guideNeeded, markGuideSeen } from '../../../src/renderer/src/components/FeatureGuide'
afterEach(()=>{localStorage.clear();vi.restoreAllMocks()})
it('offers the guide only to a new profile',()=>expect(guideNeeded()).toBe(true))
it('remembers completion or skipping across arbitrary versions',()=>{markGuideSeen('2.1.21');expect(guideNeeded('2.1.22')).toBe(false);expect(guideNeeded('3.0.0')).toBe(false);expect(localStorage.getItem('pdfuck.feature-guide.completed')).toBe('true')})
it.each(['2.1.18','2.1.18:practice-1','2.1.21:practice-1'])('migrates existing users %s',value=>{localStorage.setItem('pdfuck.feature-guide.version',value);expect(guideNeeded('3.0.0')).toBe(false);localStorage.removeItem('pdfuck.feature-guide.version');expect(guideNeeded('4.0.0')).toBe(false)})
it('ignores an invalid legacy marker',()=>{localStorage.setItem('pdfuck.feature-guide.version','false');expect(guideNeeded()).toBe(true)})
it('keeps working if storage is unavailable',()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('unavailable')});expect(guideNeeded()).toBe(true);vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('unavailable')});expect(()=>markGuideSeen()).not.toThrow()})

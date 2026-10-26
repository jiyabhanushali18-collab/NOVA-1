import React from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Scale,
  Shield,
} from 'lucide-react';
import { getLegalDocument } from '../legal/legalDocuments';
import { LegalConsentRecord, LegalDocumentType } from '../types';
import { useI18n } from '../i18n';

interface LegalDocumentViewProps {
  documentType: LegalDocumentType;
  onSelectDocument?: (docType: LegalDocumentType) => void;
  onBack: () => void;
  backLabel?: string;
  isDarkMode?: boolean;
  consentRecord?: LegalConsentRecord | null;
}

export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({
  documentType,
  onSelectDocument,
  onBack,
  backLabel = 'Back',
  isDarkMode = false,
  consentRecord,
}) => {
  const { t, locale } = useI18n();
  const docData = getLegalDocument(documentType, locale);

  return (
    <div
      className={`w-full space-y-4 pb-6 animate-fade-in ${
        isDarkMode ? 'text-slate-100' : 'text-[#131426]'
      }`}
    >
      {/* Top Bar: Back Button + Document Switcher */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel === 'Back' ? t('common.back') : backLabel}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
            isDarkMode
              ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
              : 'bg-white border-[#E4DFF5] text-[#131426] hover:bg-[#F2EEFF] hover:text-[#553BE2] shadow-[0_2px_8px_rgba(19,20,38,0.04)]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel === 'Back' ? t('common.back') : backLabel}</span>
        </button>

        {onSelectDocument && (
          <div
            role="tablist"
            aria-label={t('legal.legalCenter')}
            className={`inline-flex rounded-2xl p-1 border ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-[#E4DFF5] shadow-[0_2px_8px_rgba(19,20,38,0.04)]'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={documentType === 'terms'}
              onClick={() => onSelectDocument('terms')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                documentType === 'terms'
                  ? 'bg-[#553BE2] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-[#5E667A] hover:text-[#131426]'
              }`}
            >
              {t('legal.terms')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={documentType === 'privacy'}
              onClick={() => onSelectDocument('privacy')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                documentType === 'privacy'
                  ? 'bg-[#553BE2] text-white shadow-sm'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-[#5E667A] hover:text-[#131426]'
              }`}
            >
              {t('legal.privacy')}
            </button>
          </div>
        )}
      </div>

      {/* Hero Document Header Card */}
      <section
        className={`rounded-3xl p-5 border space-y-3.5 ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800 shadow-lg'
            : 'bg-white border-[#E4DFF5] shadow-[0_12px_28px_-6px_rgba(85,59,226,0.08),0_2px_6px_-1px_rgba(19,20,38,0.04)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                isDarkMode
                  ? 'bg-indigo-950/70 border-indigo-800/60 text-indigo-300'
                  : 'bg-[#F2EEFF] border-[#E2DBF8] text-[#553BE2]'
              }`}
            >
              {documentType === 'terms' ? (
                <Scale className="w-3 h-3" />
              ) : (
                <Shield className="w-3 h-3" />
              )}
              <span>{t('legal.legalCenter')}</span>
            </div>
            <h1
              className={`text-xl font-black tracking-tight ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}
            >
              {docData.title}
            </h1>
          </div>

          <div
            className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center border ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-indigo-400'
                : 'bg-[#F2EEFF] border-[#E2DBF8] text-[#553BE2]'
            }`}
          >
            {documentType === 'terms' ? (
              <FileText className="w-5 h-5" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>
        </div>

        <p
          className={`text-xs leading-relaxed ${
            isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
          }`}
        >
          {docData.subtitle}
        </p>

        {/* Version, Effective Date & Last Updated Badges */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div
            className={`rounded-2xl p-2.5 border ${
              isDarkMode
                ? 'bg-slate-800/70 border-slate-700/70'
                : 'bg-[#F2EEFF]/80 border-[#E4DFF5]'
            }`}
          >
            <div
              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
              }`}
            >
              <FileText className="w-3 h-3 text-[#553BE2]" />
              <span>{t('legal.version')}</span>
            </div>
            <p
              className={`text-[11px] font-extrabold mt-0.5 ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}
            >
              v{docData.version}
            </p>
          </div>

          <div
            className={`rounded-2xl p-2.5 border ${
              isDarkMode
                ? 'bg-slate-800/70 border-slate-700/70'
                : 'bg-[#F2EEFF]/80 border-[#E4DFF5]'
            }`}
          >
            <div
              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
              }`}
            >
              <Calendar className="w-3 h-3 text-[#553BE2]" />
              <span>{t('legal.effective')}</span>
            </div>
            <p
              className={`text-[11px] font-extrabold mt-0.5 ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}
            >
              {docData.effectiveDate}
            </p>
          </div>

          <div
            className={`rounded-2xl p-2.5 border ${
              isDarkMode
                ? 'bg-slate-800/70 border-slate-700/70'
                : 'bg-[#F2EEFF]/80 border-[#E4DFF5]'
            }`}
          >
            <div
              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'
              }`}
            >
              <Clock className="w-3 h-3 text-[#553BE2]" />
              <span>{t('legal.updated')}</span>
            </div>
            <p
              className={`text-[11px] font-extrabold mt-0.5 ${
                isDarkMode ? 'text-white' : 'text-[#131426]'
              }`}
            >
              {docData.lastUpdated}
            </p>
          </div>
        </div>

        {/* Read-only Recorded Consent Banner (when user is signed in and has accepted) */}
        {consentRecord && consentRecord.accepted && (
          <div
            className={`rounded-2xl p-3 border flex items-start gap-2.5 ${
              isDarkMode
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">{t('legal.auditRecorded')} </span>
              {t('legal.auditAcceptedDetails', {
                termsVersion: consentRecord.termsVersion,
                privacyVersion: consentRecord.privacyVersion,
                date: new Date(consentRecord.consentedAt).toLocaleString(
                  locale === 'hi' ? 'hi-IN' : undefined
                ),
              })}{' '}
              {t('legal.auditReadOnly')}
            </div>
          </div>
        )}

        {/* Template / Legal Review Notice */}
        <div
          className={`rounded-2xl p-3 border flex items-start gap-2.5 ${
            isDarkMode
              ? 'bg-amber-950/35 border-amber-800/50 text-amber-200'
              : 'bg-[#EDE7FF] border-[#D5CBF7] text-[#131426]'
          }`}
        >
          <Info className="w-4 h-4 text-[#553BE2] shrink-0 mt-0.5" />
          <p
            className={`text-[11px] leading-relaxed ${
              isDarkMode ? 'text-amber-100/90' : 'text-[#5E667A]'
            }`}
          >
            {docData.templateNotice}
          </p>
        </div>
      </section>

      {/* Document Sections */}
      <div className="space-y-3">
        {docData.sections.map((section) => (
          <article
            key={section.id}
            className={`rounded-3xl p-5 border space-y-2.5 ${
              isDarkMode
                ? 'bg-slate-900/80 border-slate-800'
                : 'bg-white border-[#E4DFF5] shadow-[0_10px_24px_-6px_rgba(85,59,226,0.06),0_2px_6px_-1px_rgba(19,20,38,0.03)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-7 h-7 rounded-xl text-[11px] font-black flex items-center justify-center shrink-0 border ${
                  isDarkMode
                    ? 'bg-indigo-950/80 border-indigo-800 text-indigo-300'
                    : 'bg-[#F2EEFF] border-[#E2DBF8] text-[#553BE2]'
                }`}
              >
                {section.number}
              </span>
              <h2
                className={`text-sm font-black leading-snug ${
                  isDarkMode ? 'text-white' : 'text-[#131426]'
                }`}
              >
                {section.title}
              </h2>
            </div>

            <div className="space-y-2">
              {section.paragraphs.map((paragraph, idx) => (
                <p
                  key={idx}
                  className={`text-xs leading-relaxed ${
                    isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
                  }`}
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {section.bullets.map((bullet, idx) => (
                  <li
                    key={idx}
                    className={`flex items-start gap-2 text-xs leading-relaxed ${
                      isDarkMode ? 'text-slate-300' : 'text-[#131426]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#553BE2] shrink-0 mt-1.5" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.reviewNote && (
              <div
                className={`mt-2 rounded-2xl px-3 py-2 border text-[11px] leading-relaxed ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-slate-300'
                    : 'bg-[#F2EEFF]/75 border-[#E4DFF5] text-[#5E667A]'
                }`}
              >
                <span className="font-bold text-[#553BE2]">
                  {t('legal.reviewItemPrefix')}
                </span>
                {section.reviewNote}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Items Requiring Business / Legal Confirmation Before Publishing */}
      <section
        className={`rounded-3xl p-5 border space-y-2.5 ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800'
            : 'bg-white border-[#E4DFF5] shadow-[0_10px_24px_-6px_rgba(85,59,226,0.06)]'
        }`}
      >
        <h3
          className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
            isDarkMode ? 'text-indigo-300' : 'text-[#553BE2]'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>{t('legal.unverifiedTitle')}</span>
        </h3>
        <ul className="space-y-1.5">
          {docData.unverifiedItems.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 text-[11px] leading-relaxed ${
                isDarkMode ? 'text-slate-300' : 'text-[#5E667A]'
              }`}
            >
              <span className="font-bold text-[#553BE2]">{idx + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Bottom Action Bar */}
      <div className="pt-1 flex items-center gap-2.5">
        {onSelectDocument && (
          <button
            type="button"
            onClick={() =>
              onSelectDocument(documentType === 'terms' ? 'privacy' : 'terms')
            }
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-[#E4DFF5] text-[#553BE2] hover:bg-[#F2EEFF]'
            }`}
          >
            {documentType === 'terms' ? t('legal.viewPrivacy') : t('legal.viewTerms')}
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-2xl text-xs font-bold bg-[#553BE2] hover:bg-[#462CC9] text-white shadow-md shadow-[#553BE2]/20 transition-all cursor-pointer active:scale-[0.98]"
        >
          {backLabel === 'Back' ? t('common.back') : backLabel}
        </button>
      </div>
    </div>
  );
};

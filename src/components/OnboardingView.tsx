import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Check, Smartphone, BarChart3, HelpCircle, ShieldCheck, Heart, Layout, Tag, MessageSquare, Compass, Info, Scale, CheckSquare } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

interface OnboardSlide {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  illustrations: React.ReactNode;
}

export const OnboardingView: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  // Features list of the smart mirror to show around mockups (Slide 1)
  const features = [
    { label: 'Virtual Try-On', icon: 'view_in_ar', color: 'indigo' },
    { label: 'Inventory Tracking', icon: 'inventory', color: 'slate' },
    { label: 'Size Availability', icon: 'straighten', color: 'amber' },
    { label: 'Digital Coupons', icon: 'percent', color: 'rose' },
    { label: 'Smart Suggestions', icon: 'lightbulb', color: 'indigo' },
    { label: 'Hygiene Friendly', icon: 'hygiene', color: 'emerald' },
  ];

  const slides: OnboardSlide[] = [
    {
      badge: 'SMART MIRROR SYSTEM',
      title: 'Try it. Love it. Virtually.',
      subtitle: 'AI-Powered Smart Mirror & Virtual Clothing Try-On System',
      description: 'NOVA is your digital partner that lets you try on premium outfits, discover optimal sizes, receive professional style guidance, and checkout instantly — all in real-time.',
      illustrations: (
        <div className="relative w-full h-[280px] bg-[#ECE7FF]/45 rounded-[28px] border border-[#E4DFF5] flex items-center justify-center p-4 overflow-hidden mt-2">
          {/* Grid background mask */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#E4DFF5_1px,transparent_1px),linear-gradient(to_bottom,#E4DFF5_1px,transparent_1px)] bg-[size:16px_16px] opacity-60"></div>
          
          <div className="relative flex w-full h-full items-center justify-between gap-2 z-10">
            {/* Left Column features */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-[#E4DFF5] shadow-sm">
                <div className="w-5 h-5 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">view_in_ar</span>
                </div>
                <span className="text-[10px] font-black text-[#131426]">Virtual Try-On</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-[#E4DFF5] shadow-sm">
                <div className="w-5 h-5 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">straighten</span>
                </div>
                <span className="text-[10px] font-black text-[#131426]">Size Auto-Fit</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-[#E4DFF5] shadow-sm">
                <div className="w-5 h-5 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">lightbulb</span>
                </div>
                <span className="text-[10px] font-black text-[#131426]">Smart Advice</span>
              </div>
            </div>

            {/* Simulated Live viewport phone frame in middle */}
            <div className="w-[145px] h-[255px] bg-[#131426] rounded-[24px] p-1.5 border-[3px] border-[#252742] shadow-xl relative shrink-0">
              {/* Phone capsule bar */}
              <div className="w-12 h-3 bg-[#252742] rounded-full mx-auto mb-1 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-[#0f101d] rounded-full"></div>
              </div>

              {/* Screen inside */}
              <div className="w-full h-full rounded-[18px] bg-[#F2EEFF] overflow-hidden relative border border-[#252742] flex flex-col justify-between">
                {/* Model preview background */}
                <img 
                  src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=400" 
                  alt="Virtual tryon mockup model"
                  className="absolute inset-0 w-full h-full object-cover opacity-85"
                />
                
                {/* Dynamic tryon interface element */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#131426]/75 via-transparent to-transparent flex flex-col justify-end p-2">
                  <div className="bg-white/95 backdrop-blur-md rounded-xl p-1.5 border border-[#E4DFF5] shadow text-center">
                    <span className="text-[8px] font-black tracking-wider text-[#553BE2] block uppercase">AR SELECTION</span>
                    <p className="text-[9px] font-black text-[#131426] leading-none mt-0.5">Lavender Fleece Hoodie</p>
                    <div className="flex justify-center gap-1 mt-1">
                      <span className="w-2 h-2 rounded-full bg-[#553BE2] border border-white"></span>
                      <span className="w-2 h-2 rounded-full bg-blue-500 border border-white"></span>
                      <span className="w-2 h-2 rounded-full bg-rose-500 border border-white"></span>
                    </div>
                  </div>
                </div>

                {/* Secure Badge top corner */}
                <div className="absolute top-1 right-1 bg-[#553BE2] text-white font-mono text-[6px] py-0.5 px-1.5 rounded-full font-black uppercase">
                  98% FIT RATE
                </div>
              </div>
            </div>

            {/* Right Column features */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-[#E4DFF5] shadow-sm">
                <div className="w-5 h-5 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">inventory</span>
                </div>
                <span className="text-[10px] font-black text-[#131426]">Stock Alerts</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white py-1 px-2.5 rounded-full border border-[#E4DFF5] shadow-sm">
                <div className="w-5 h-5 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[12px] font-bold">verified</span>
                </div>
                <span className="text-[10px] font-black text-[#131426]">Hygiene Fit</span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      badge: 'AI CURATION & STYLIST',
      title: 'Stylist AI Assistant',
      subtitle: 'Chat, query, color match and build custom lookbooks',
      description: 'Consult our secure digital styling guru. Type any query to match active seasonal collections, construct color charts, find alternatives, and customize sizes instantly.',
      illustrations: (
        <div className="relative w-full h-[280px] bg-[#ECE7FF]/45 rounded-[28px] border border-[#E4DFF5] flex items-center justify-center p-4 overflow-hidden mt-2">
          <div className="absolute inset-0 bg-radial-gradient(ellipse_60%_60%_at_50%_50%,#ECE7FF_20%,transparent_100%) opacity-50"></div>
          
          <div className="w-full max-w-xs bg-white rounded-2xl shadow-lg border border-[#E4DFF5] overflow-hidden relative z-10 flex flex-col h-full">
            {/* Curation header representative */}
            <div className="bg-[#553BE2] p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white leading-none">NOVA STYLIST</p>
                  <span className="text-[7px] font-semibold text-[#ECE7FF]">Active Guidance Engine</span>
                </div>
              </div>
              <span className="text-[8px] bg-emerald-500 text-white py-0.5 px-2 rounded-full font-bold">ONLINE</span>
            </div>

            {/* Mini message threads representation */}
            <div className="p-3 flex-1 flex flex-col gap-2 justify-center">
              <div className="bg-[#F2EEFF] border border-[#E4DFF5] py-1.5 px-2.5 rounded-xl text-left max-w-[85%]">
                <p className="text-[9px] font-semibold text-[#131426]">"What layer matches with blue denim jeans?"</p>
              </div>
              
              <div className="self-end bg-[#F2EEFF] border border-[#E4DFF5] py-2 px-2.5 rounded-xl text-left max-w-[85%] flex gap-1.5 items-start">
                <Sparkles className="w-3.5 h-3.5 text-[#553BE2] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[9px] font-bold text-[#131426] leading-tight">
                    "I suggest matching with our Lavender Fleece Hoodie. Its soft pastel contrast elevates blue denim beautifully!"
                  </p>
                  <div className="mt-1 flex items-center gap-1 bg-white p-1 rounded border border-[#E4DFF5] w-28">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#553BE2] shrink-0"></span>
                    <span className="text-[7px] font-bold text-[#5E667A] truncate">Lavender Hoodie</span>
                    <span className="text-[7px] font-black text-[#553BE2] ml-auto">₹1,499</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      badge: 'REALTIME OOTD SCANNER',
      title: 'Scan Your Active Wardrobe',
      subtitle: 'Identify products, materials and suggest alterations',
      description: 'Use your terminal camera to scan physical garments in any store. Instantly detect fabrics, evaluate pricing variations, and access virtual size overlays inside the try-on modules.',
      illustrations: (
        <div className="relative w-full h-[280px] bg-[#ECE7FF]/45 rounded-[28px] border border-[#E4DFF5] flex items-center justify-center p-4 overflow-hidden mt-2">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          
          <div className="w-52 h-full bg-white rounded-2xl shadow-xl border border-[#E4DFF5] relative overflow-hidden flex flex-col p-3 z-10 justify-between">
            {/* Viewport frame mimicking a phone camera capturing clothing */}
            <div className="relative flex-1 bg-[#F2EEFF] rounded-xl overflow-hidden flex items-center justify-center">
              <img 
                src="https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=400" 
                alt="Active scanning clothing mockup"
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Green targeting rect overlays mimicking real-time camera scanning */}
              <div className="absolute inset-3 border-2 border-emerald-500 border-dashed rounded-lg flex items-center justify-center">
                {/* Horizontal scanning light beam */}
                <div className="absolute left-0 right-0 h-1 bg-emerald-400 opacity-60 top-1/3 animate-bounce"></div>
                
                {/* Identified info box marker anchor */}
                <div className="absolute bottom-2 left-2 bg-emerald-600 text-white p-1 rounded shadow text-left flex flex-col leading-none">
                  <span className="text-[6px] font-bold uppercase tracking-widest text-emerald-200">OBJECT TRACKED</span>
                  <p className="text-[8px] font-black mt-0.5">Classic Blue Denim Jeans</p>
                  <span className="text-[6px] font-medium opacity-80 mt-0.5">99.1% Confidence match</span>
                </div>
              </div>
            </div>

            {/* Quick telemetry parameters */}
            <div className="mt-2 flex justify-between items-center text-[8px] font-bold text-[#5E667A] font-mono">
              <span>SCANRATE: 60帧/S</span>
              <span className="text-emerald-500 animate-pulse">● FEED ONLINE</span>
            </div>
          </div>
        </div>
      )
    },
    {
      badge: 'HYGIENE FRIENDLY DIGITAL MIRROR',
      title: 'Digital Wardrobe Tracker',
      subtitle: 'Hygiene Friendly, Instant Sizing recommendation',
      description: 'Skip physical matching queues. Build your perfect personal measurements checklist securely inside your Profile and explore dynamic sizing alerts instantly across all retail vendors.',
      illustrations: (
        <div className="relative w-full h-[280px] bg-[#ECE7FF]/45 rounded-[28px] border border-[#E4DFF5] flex items-center justify-center p-4 overflow-hidden mt-2">
          {/* Circular light beam backing */}
          <div className="absolute w-44 h-44 rounded-full bg-[#553BE2]/10 blur-2xl"></div>

          <div className="relative z-10 w-full max-w-xs flex flex-col gap-4">
            
            {/* Visual list of safe items */}
            <div className="bg-white rounded-xl border border-[#E4DFF5] shadow-sm p-3 flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5.5 h-5.5" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-[11px] font-black text-[#131426] uppercase tracking-wide leading-none">Hygiene Certified 100%</h4>
                <p className="text-[9px] text-[#5E667A] mt-1 leading-tight">Virtual testing ensures complete safety, zero fabric contact, and perfect sanitation.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E4DFF5] shadow-sm p-3 flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-[#F2EEFF] text-[#553BE2] flex items-center justify-center font-bold">
                <CheckSquare className="w-5.5 h-5.5" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="text-[11px] font-black text-[#131426] uppercase tracking-wide leading-none">Smart Fit Checker</h4>
                <p className="text-[9px] text-[#5E667A] mt-1 leading-tight">Calculates chest, shoulders, length, and waist dimensions to flag custom tight/loose warnings.</p>
              </div>
            </div>

          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(activeSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (activeSlide > 0) {
      setActiveSlide(activeSlide - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between max-w-md mx-auto relative bg-[#F2EEFF] nova-page-wash overflow-hidden font-sans border-x border-[#E4DFF5] shadow-2xl">
      
      {/* 1. Header Toolbar branding display */}
      <header className="px-6 pt-5 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-[#553BE2] flex items-center justify-center text-white font-extrabold shadow-sm shadow-[#553BE2]/25">
            N
          </div>
          <div className="leading-none text-left">
            <span className="text-sm font-black tracking-tight text-[#131426] block">NOVA</span>
            {/* subtitle removed to display only NOVA */}
          </div>
        </div>

        {/* Skip button allows the user directly navigate into home screen */}
        <button 
          onClick={onComplete}
          className="text-xs font-bold text-[#5E667A] hover:text-[#553BE2] transition-colors uppercase tracking-widest outline-none"
        >
          Skip
        </button>
      </header>

      {/* 2. Interactive Body slider */}
      <main className="flex-1 px-6 flex flex-col justify-center mt-3 mb-4">
        
        {/* Carousel slide contents with dynamic container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="flex flex-col gap-4 text-center"
          >
            {/* Slide Category Badge top */}
            <div className="inline-flex mx-auto bg-[#F2EEFF] border border-[#E4DFF5] text-[#553BE2] py-1 px-3 rounded-full text-[9px] font-black tracking-widest uppercase font-mono">
              {slides[activeSlide].badge}
            </div>

            {/* Slide heading title */}
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-[#131426] tracking-tight leading-tight">
                {slides[activeSlide].title}
              </h1>
              <p className="text-[11px] font-bold text-[#5E667A] uppercase tracking-widest leading-none mt-0.5">
                {slides[activeSlide].subtitle}
              </p>
            </div>

            {/* Custom vector illustration showcase component render */}
            <div className="py-1">
              {slides[activeSlide].illustrations}
            </div>

            {/* Feature descriptive explanation */}
            <p className="text-[12px] text-[#5E667A] leading-relaxed max-w-sm mx-auto font-medium px-2">
              {slides[activeSlide].description}
            </p>
          </motion.div>
        </AnimatePresence>

      </main>

      {/* 3. Bottom dots indicator and "Next / Let's Go" navigation buttons */}
      <footer className="px-6 pb-12 pt-3 flex flex-col gap-5 shrink-0 border-t border-[#E4DFF5] bg-white/75 backdrop-blur-md">
        
        <div className="flex items-center justify-between">
          
          {/* Custom dot indicator */}
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`h-2 rounded-full transition-all duration-350 ${idx === activeSlide ? 'w-6 bg-[#553BE2]' : 'w-2 bg-[#E4DFF5]'}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action triggers switcher */}
          <div className="flex items-center gap-2">
            {activeSlide > 0 && (
              <button
                onClick={handleBack}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-[#5E667A] hover:text-[#131426] transition-colors uppercase outline-none"
              >
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="py-3 px-6 rounded-xl bg-[#553BE2] hover:bg-[#462CC9] text-white text-xs font-extrabold shadow-lg shadow-[#553BE2]/30 transition-all flex items-center gap-1.5 cursor-pointer outline-none active:scale-95 text-center leading-none uppercase tracking-wider"
            >
              {activeSlide === slides.length - 1 ? (
                <>
                  Get Started <Check className="w-4 h-4 font-black" />
                </>
              ) : (
                <>
                  Next <ArrowRight className="w-4 h-4 font-black" />
                </>
              )}
            </button>
          </div>

        </div>

      </footer>
    </div>
  );
};

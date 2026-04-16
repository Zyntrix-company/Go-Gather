import React from 'react';

export const PhoneMockup = () => {
  return (
    <div className="relative w-[300px] lg:w-[260px] h-auto bg-white/20 backdrop-blur-xl rounded-[40px] shadow-2xl border-[4px] border-slate-900 overflow-hidden mx-auto select-none">
       {/* Notch/Island area */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-900 rounded-b-xl z-20"></div>

       {/* Screen Content - Fits the frame to the image */}
       <img
          src="/image.png"
          alt="App Interface"
          className="w-full h-auto block"
       />
    </div>
  );
};

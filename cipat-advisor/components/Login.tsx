import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, ArrowRight, Droplets, X, Check, Eye, EyeOff, ShieldCheck, Mail, KeyRound } from 'lucide-react';
import { supabase } from '../src/lib/supabase';
import { Capacitor } from '@capacitor/core';

interface LoginProps { 
  onLogin: (userData: any) => void; 
  onShowTerms?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onShowTerms }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [gardenSize, setGardenSize] = useState('0');
  const [gardenType, setGardenType] = useState('Farm');
  const [soilType, setSoilType] = useState('Loam');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [shake, setShake] = useState(false);

  // OTP System States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(''));
  const [countdown, setCountdown] = useState(0);
  const [isTestMode, setIsTestMode] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [verificationChannel, setVerificationChannel] = useState<'email' | 'whatsapp'>('email');

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    const cleanValue = value.replace(/\D/g, '').substring(0, 1);
    const newOtpCode = [...otpCode];
    newOtpCode[index] = cleanValue;
    setOtpCode(newOtpCode);

    if (cleanValue && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
    if (pastedData.length === 6) {
      const newOtpCode = pastedData.split('');
      setOtpCode(newOtpCode);
      otpInputsRef.current[5]?.focus();
    }
  };

  const validate = (checkOtpOnly = false) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\d{10}$/;

    if (checkOtpOnly) {
      const code = otpCode.join('');
      if (code.length < 6) {
        setError("Please enter the 6-digit verification code");
        return false;
      }
      return true;
    }

    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }
    
    if (mode === 'signup') {
      if (!name.trim() || name.trim().length < 2) {
        setError("Name must be at least 2 characters long");
        return false;
      }
      if (!phone.trim() || !phoneRegex.test(phone)) {
        setError("Please enter a valid 10-digit mobile number");
        return false;
      }
      if (!location.trim()) {
        setError("Location is required");
        return false;
      }
      if (parseFloat(gardenSize) < 0) {
        setError("Garden size cannot be negative");
        return false;
      }
    }

    // Password is required for both login and signup (prior to OTP)
    if (!password.trim()) {
      setError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setError("Password requires at least 6 characters");
      return false;
    }

    if (!acceptedTerms) {
      setError(`Please accept the Security Protocols to ${mode === 'login' ? 'login' : 'sign up'}`);
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    setError(null);
    if (!validate(false)) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);
    setIsTestMode(false);
    setSimulatedCode(null);

    // Prevent duplicate mobile numbers on signup
    if (mode === 'signup') {
      try {
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone.trim())
          .maybeSingle();

        if (checkError) {
          console.error("Phone duplication check error:", checkError);
        }

        if (existingUser) {
          setError("This mobile number is already registered with another account.");
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.error("Failed to query phone existence:", err);
      }
    }

    // Check for test bypass email
    if (email.trim().toLowerCase() === 'test@test.com') {
      setOtpSent(true);
      setIsTestMode(true);
      setSimulatedCode('123456');
      setCountdown(60);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(),
          phone: phone.trim(),
          method: verificationChannel
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('The server returned an invalid response (not JSON). Please make sure the Express backend server is running using "npm run server" or "npm run dev".');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setOtpSent(true);
      setCountdown(60);
      
      if (data.simulated) {
        setIsTestMode(true);
        setSimulatedCode(data.otp);
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(err.message || "Unable to send verification email. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Flow 1: Traditional Email/Password Login
    if (mode === 'login') {
      if (!validate(false)) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      setLoading(true);

      // Bypass check for test@test.com / password123
      if (email === 'test@test.com' && password === 'password123') {
        try {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (!signInError && data?.user) {
            onLogin({ email, id: data.user.id });
            return;
          }
          
          if (signInError && (signInError.message.includes("Invalid login credentials") || signInError.status === 400)) {
            console.log("Test user not found, registering automatically...");
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
            });

            if (!signUpError && signUpData?.user) {
              const profileData = {
                id: signUpData.user.id,
                email,
                full_name: 'Test Farmer',
                phone: '9999999999',
                location: 'Test Farm, Earth',
                garden_type: 'Farm',
                garden_size: 10,
                created_at: new Date().toISOString()
              };
              await supabase.from('users').insert([profileData]);
              onLogin({ email, id: signUpData.user.id });
              return;
            }
          }
        } catch (err) {
          console.warn("Bypass authentication failed:", err);
        }

        const bypassCountStr = localStorage.getItem('testBypassCount') || '0';
        let bypassCount = parseInt(bypassCountStr, 10);
        if (bypassCount < 50) {
          localStorage.setItem('testBypassCount', (bypassCount + 1).toString());
          onLogin({ email, id: 'test_user_id' });
          return;
        }
      }

      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (signInError) throw signInError;
        onLogin({ email: email.trim() });
      } catch (err: any) {
        console.error("Auth error detail:", err);
        let msg = err.message || "An error occurred during authentication.";
        
        if (msg.toLowerCase().includes("rate limit")) {
          msg = "Email rate limit exceeded. Please wait a while or use Google Login.";
        }
        
        setError(msg);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Flow 2: Signup Email Verification (OTP)
    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!validate(true)) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);

    if (isTestMode && email.trim().toLowerCase() === 'test@test.com') {
      // Skip server verification, proceed directly to signup
    } else {
      try {
        const response = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email.trim(), 
            otp: otpCode.join('') 
          }),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('The server returned an invalid response (not JSON). Please make sure the Express backend server is running using "npm run server" or "npm run dev".');
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Invalid verification code');
        }
      } catch (err: any) {
        console.error("Verify OTP error:", err);
        setError(err.message || "Verification failed. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setLoading(false);
        return;
      }
    }

    // OTP verified, create account with Supabase using user-provided password
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered") || signUpError.status === 400) {
          // If already registered, try to log in
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
          if (signInError) throw signUpError;
          onLogin({ email: email.trim(), id: signInData.user.id });
          return;
        }
        throw signUpError;
      }
      
      const user = signUpData.user;
      if (user) {
        const profileData = {
          id: user.id,
          email: email.trim(),
          full_name: name.trim() || 'New Farmer',
          phone: phone.trim() || '',
          location: location.trim() || '',
          garden_type: gardenType,
          garden_size: parseFloat(gardenSize) || 0,
          created_at: new Date().toISOString()
        };

        const { error: profileError } = await supabase
          .from('users')
          .insert([profileData]);

        if (profileError) {
          console.error("Signup profile error:", profileError);
        }
        
        onLogin({ email: email.trim(), id: user.id });
        return;
      }
    } catch (err: any) {
      console.error("Supabase signUp error:", err);
      setError(err.message || "Sign up failed. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get the exact domain and path so Supabase knows where to send us back
      let redirectTo = window.location.origin;
      
      // If we are on Android (Capacitor), use the custom deep link scheme
      if (Capacitor.isNativePlatform()) {
        redirectTo = 'com.ecodrip.app://login-callback';
      }

      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true
        }
      });
      
      if (googleError) throw googleError;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      const msg = err.message || "Google sign-in failed.";
      setError(msg.includes("provider") ? `${msg} (Check if Google is enabled in Supabase Dashboard)` : msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-[-15%] left-[-15%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none md:block hidden"></div>

      {error && (
        <div className="fixed top-10 left-6 right-6 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-50 bg-slate-900 text-white p-5 rounded-3xl flex items-center gap-4 animate-slide-up shadow-2xl border border-white/10">
          <AlertCircle size={22} className="text-rose-500 shrink-0" />
          <p className="text-xs font-bold flex-grow">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} /></button>
        </div>
      )}

      <div className={`w-full max-w-[400px] md:max-w-[800px] md:bg-white md:shadow-2xl md:rounded-[3rem] md:flex md:overflow-hidden relative z-10 transition-all duration-300 ${shake ? 'animate-shake' : ''}`}>
        
        {/* Left Side (Branding/Image for Tablet/Laptop) */}
        <div className="hidden md:flex flex-col justify-between w-1/2 bg-teal-600 p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.2] mix-blend-screen"></div>
          <div className="absolute -bottom-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_#34d399_0%,_transparent_40%)] opacity-[0.3] blur-[80px] animate-[spin_40s_linear_infinite]"></div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md mb-8">
              <Droplets size={32} className="text-white" />
            </div>
            <h2 className="text-4xl font-black italic tracking-tighter mb-4">Eco-Drip</h2>
            <p className="text-teal-100 font-medium leading-relaxed">
              The world's most advanced autonomous smart irrigation network. Manage your crops, monitor vital metrics, and let AI handle the watering.
            </p>
          </div>
          <div className="relative z-10 mt-auto">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-teal-200" />
              <span className="text-xs font-bold tracking-widest uppercase text-teal-200">End-to-End Encrypted</span>
            </div>
          </div>
        </div>

        {/* Right Side (Form Area) */}
        <div className="w-full md:w-1/2 p-6 md:p-12 bg-white">
          <div className="mb-8 md:mb-10 text-center md:text-left">
            <div className="w-16 h-16 bg-teal-600 rounded-2xl flex md:hidden items-center justify-center mx-auto mb-6 shadow-xl shadow-teal-500/20">
              <Droplets size={32} className="text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter italic md:hidden">Eco-Drip</h1>
            <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">
              {mode === 'login' ? 'Access your smart hub' : 'Initiate on-boarding'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4" noValidate>
            {otpSent ? (
              <div className="space-y-6 py-2">
                <div className="text-center md:text-left space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verification Sent</p>
                  <p className="text-sm font-black text-teal-600 tracking-tight">{email}</p>
                </div>
                
                {isTestMode && simulatedCode && (
                  <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Developer Bypass Active</p>
                    <p className="text-xs font-bold text-amber-600">Enter code <strong className="font-extrabold text-sm">{simulatedCode}</strong> to proceed.</p>
                  </div>
                )}

                <div className="flex justify-between items-center gap-2 px-1">
                  {otpCode.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      ref={(el) => { otpInputsRef.current[idx] = el; }}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      className="w-12 h-14 md:w-14 md:h-16 text-center text-xl md:text-2xl font-black text-slate-900 bg-slate-50 border-2 border-slate-100 focus:border-teal-500 rounded-2xl outline-none transition-all focus:scale-105 focus:shadow-lg focus:shadow-teal-500/10"
                    />
                  ))}
                </div>

                <div className="text-center">
                  {countdown > 0 ? (
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Resend code in <span className="text-teal-600 font-extrabold">{countdown}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 underline underline-offset-4 active:scale-95 transition-all"
                    >
                      Resend verification code
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {mode === 'signup' && (
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                    />
                    <input 
                      type="text" 
                      placeholder="Mobile Number (10 digits)"
                      value={phone}
                      maxLength={10}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                    />
                    
                    {/* Verification Method Selection */}
                    <div className="space-y-2 py-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-2 text-left">OTP Delivery Channel</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVerificationChannel('email')}
                          className={`flex-1 py-3 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${verificationChannel === 'email' ? 'border-teal-600 bg-teal-50/30 text-teal-700' : 'border-transparent bg-slate-50 text-slate-400 hover:text-slate-500'}`}
                        >
                          <Mail size={15} />
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerificationChannel('whatsapp')}
                          className={`flex-1 py-3 px-3 rounded-2xl border-2 flex items-center justify-center gap-2 text-xs font-bold transition-all ${verificationChannel === 'whatsapp' ? 'border-emerald-600 bg-emerald-50/30 text-emerald-700' : 'border-transparent bg-slate-50 text-slate-400 hover:text-slate-500'}`}
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.114-2.905-6.989-1.874-1.875-4.361-2.906-6.993-2.907-5.437 0-9.864 4.42-9.867 9.864-.001 1.735.452 3.43 1.312 4.937l-.989 3.608 3.692-.969zm8.563-5.228c-.28-.14-1.654-.816-1.91-.908-.255-.093-.441-.14-.627.14-.186.28-.718.908-.88 1.093-.163.186-.326.21-.605.07-.279-.14-1.18-.435-2.247-1.387-.83-.74-1.39-1.653-1.553-1.933-.163-.28-.018-.431.122-.571.125-.125.28-.327.42-.49.139-.163.186-.28.279-.465.093-.186.046-.35-.023-.49-.069-.14-.627-1.511-.86-2.07-.226-.546-.456-.472-.627-.48l-.534-.01c-.186 0-.488.07-.743.35-.256.279-.975.953-.975 2.327-.001 1.373.999 2.7 1.138 2.887.14.186 1.966 3.003 4.763 4.21.665.286 1.184.457 1.587.585.667.213 1.275.183 1.756.11.535-.08 1.654-.675 1.887-1.326.232-.651.232-1.21.162-1.325-.07-.11-.256-.179-.534-.319z"/>
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Location / Region"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                    />
                    <div className="flex bg-slate-50 p-1 rounded-2xl gap-1 mb-2">
                      {(['Farm', 'Orchard', 'Garden'] as const).map((type) => (
                        <button 
                          key={type}
                          type="button"
                          onClick={() => setGardenType(type)}
                          className={`flex-1 py-3 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${gardenType === type ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-500'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <div className="flex bg-slate-50 p-1 rounded-2xl gap-1 mb-2">
                      {(['Clay', 'Loam', 'Sand'] as const).map((type) => (
                        <button 
                          key={type}
                          type="button"
                          onClick={() => setSoilType(type)}
                          className={`flex-1 py-3 md:py-4 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${soilType === type ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-500'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <input 
                      type="number" 
                      placeholder="Total Area (Acres)"
                      value={gardenSize}
                      onChange={(e) => setGardenSize(e.target.value)}
                      className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                )}
                
                <input 
                  type="email" 
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                />

                <div className="relative group">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 md:p-5 bg-slate-50 border-2 border-transparent focus:border-teal-500 rounded-2xl font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 pr-14"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 inset-y-0 my-auto w-10 h-10 flex items-center justify-center text-slate-300 hover:text-teal-600 transition-all z-20 rounded-xl active:scale-90"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            )}

            {!otpSent && (
              <div className="flex items-center gap-3 px-2 py-2">
                <button 
                  type="button"
                  onClick={() => setAcceptedTerms(!acceptedTerms)}
                  className={`w-5 h-5 md:w-6 md:h-6 shrink-0 rounded-lg flex items-center justify-center transition-all border-2 ${acceptedTerms ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-200 bg-slate-50'}`}
                >
                  {acceptedTerms && <Check size={12} strokeWidth={4} />}
                </button>
                <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-normal">
                  I accept the <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">Terms</a> & <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">Privacy Policy</a>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-5 md:py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl mt-4 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  {mode === 'login' ? (
                    <>
                      Login
                      <ArrowRight size={18} />
                    </>
                  ) : (
                    otpSent ? (
                      <>
                        Verify & Create Account
                        <ArrowRight size={18} />
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight size={18} />
                      </>
                    )
                  )}
                </>
              )}
            </button>

            {otpSent && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode(Array(6).fill(''));
                    setError(null);
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 py-2 active:scale-95 transition-all"
                >
                  ← Change Email or Go Back
                </button>
              </div>
            )}
          </form>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-4 py-2">
              <div className="h-px bg-slate-100 flex-grow"></div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Or</span>
              <div className="h-px bg-slate-100 flex-grow"></div>
            </div>
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 md:py-5 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-slate-50 disabled:opacity-70"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.9 0 3.53.64 4.87 1.91l3.6-3.6C18.18 1.16 15.34 0 12 0 7.31 0 3.25 2.7 1.21 6.64l4.22 3.27C6.42 6.95 8.99 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.49 12.27c0-.85-.07-1.68-.22-2.48H12v4.69h6.44c-.28 1.48-1.11 2.74-2.37 3.59l3.69 2.87c2.16-1.99 3.41-4.91 3.41-8.67z" />
                <path fill="#FBBC05" d="M5.43 14.11a7.114 7.114 0 0 1 0-4.22L1.21 6.64a11.962 11.962 0 0 0 0 10.72l4.22-3.25z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.69-2.87c-1.1.74-2.51 1.18-4.25 1.18-3.01 0-5.58-2.03-6.49-4.75l-4.22 3.25C3.25 21.3 7.31 24 12 24z" />
              </svg>
              Google Identity
            </button>
          </div>

          <div className="mt-8 md:mt-10 text-center">
            <button 
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setOtpSent(false);
                setOtpCode(Array(6).fill(''));
                setVerificationChannel('email');
              }}
              className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest hover:text-teal-600 transition-colors py-2"
            >
              {mode === 'login' ? (
                <>New here? <span className="text-teal-600 underline underline-offset-4">Create account</span></>
              ) : (
                <>Already have an account? <span className="text-teal-600 underline underline-offset-4">Login</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

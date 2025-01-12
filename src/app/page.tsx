'use client'

import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

export default function LandingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleGetStarted = async () => {
    try {
      // Only check session without triggering a full auth refresh
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error checking session:', error)
        router.push('/auth/sign-in')
        return
      }
      
      // If user is already signed in, redirect to app
      if (session?.user) {
        router.push('/app')
      } else {
        // If not signed in, redirect to sign-in page
        router.push('/auth/sign-in')
      }
    } catch (error) {
      console.error('Error checking auth state:', error)
      // On error, safely redirect to sign-in
      router.push('/auth/sign-in')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-[#4A3B8C]/2 to-[#5D3B9E]/3 overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-10 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animate-float" />
        <div className="absolute top-3/4 -right-10 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animation-delay-2000 animate-float" />
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-[#b2b0b5]/10 rounded-full animation-delay-4000 animate-float" />
      </div>

      {/* Rocket Animation */}
      <motion.div
        className="absolute select-none pointer-events-none z-50"
        initial={{ x: "25vw", y: "85vh" }}
        animate={{
          x: [
            "25vw",
            "25.5vw", "24.5vw", "25.7vw", "24.3vw", "25vw", "25.5vw", "24.5vw", "25.7vw", "24.3vw", "25vw",
            "25vw",
          ],
          y: [
            "85vh",
            "85vh", "84.8vh", "85vh", "84.8vh", "85vh", "85vh", "84.8vh", "85vh", "84.8vh", "85vh",
            "-20vh",
          ]
        }}
        transition={{
          duration: 3.5,
          times: [
            0,
            0.057, 0.114, 0.171, 0.228, 0.285, 0.342, 0.399, 0.456, 0.513, 0.57,
            1
          ],
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeOut"
        }}
      >
        <div className="w-24 h-24">
          <DotLottieReact
            src="https://lottie.host/75724373-57c4-42db-90b2-2e5a8d8c9c7c/iJkgETcViz.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-4 h-screen flex flex-col items-center justify-center text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="w-24 h-24 mx-auto mb-4 relative">
            <motion.div
              className="absolute inset-0 rounded-xl bg-[#4A3B8C]"
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
                repeatType: "loop"
              }}
            />
            <div className="absolute inset-1 rounded-lg bg-background flex items-center justify-center">
              <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#4A3B8C] to-[#5D3B9E]">
                CG
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#4A3B8C] to-[#5D3B9E]">
            ChatGenius
          </h1>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-xl text-muted-foreground mb-8 max-w-md"
        >
          Experience the future of team collaboration with AI-powered chat
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Button 
            size="lg" 
            className="text-lg px-8 bg-[#4A3B8C] hover:bg-[#3A2E6E]"
            onClick={handleGetStarted}
          >
            Get Started
          </Button>
        </motion.div>
      </div>
    </div>
  )
}


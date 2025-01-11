import { motion } from 'framer-motion'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-24 h-24'
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-4xl'
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes[size]} relative flex-shrink-0`}>
        <motion.div
          className="absolute inset-0 rounded-xl bg-[#b2b0b5]"
          animate={{ rotate: 360 }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop"
          }}
        />
        <div className="absolute inset-1 rounded-lg bg-white flex items-center justify-center">
          <span className={`${textSizes[size]} font-bold text-[#3A2E6E]`}>
            CG
          </span>
        </div>
      </div>
      {showText && (
        <h1 className={`${textSizes[size]} font-bold text-inherit truncate`}>
          ChatGenius
        </h1>
      )}
    </div>
  )
} 
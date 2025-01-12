import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function VerifyPage({ searchParams }: Props) {
  const params = await searchParams
  const email = params.email || ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We've sent a magic link to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Click the link in your email to sign in to your account.</p>
          <p className="mt-2">Don't see the email? Check your spam folder.</p>
        </CardContent>
      </Card>
    </div>
  )
} 
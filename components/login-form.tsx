'use client';

import type React from 'react';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/ui/card';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Separator } from '@/ui/separator';
import { Alert, AlertDescription } from '@/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { LogIn, Shield, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import SingleLogo from '../assets/images/single-logo.png';

export function LoginForm() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signUp(email, password);

    if (error) {
      setError(error.message);
    } else {
      setMessage('¡Cuenta creada! Revisa tu email para confirmar tu cuenta.');
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    const { error } = await signInWithGoogle();

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4'>
      <div className='w-full max-w-md space-y-6'>
        <div className='text-center space-y-2'>
          <div className='flex justify-center'>
            <Image src={SingleLogo} width={60} alt='Personal Wallet logo' />
          </div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
            Personal Wallet
          </h1>
          <p className='text-gray-600 dark:text-gray-300'>
            Gestiona tus finanzas de manera segura
          </p>
        </div>

        <Card className='shadow-lg'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl text-center'>Acceder</CardTitle>
            <CardDescription className='text-center'>
              Inicia sesión o crea una cuenta nueva
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {error && (
              <Alert variant='destructive'>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue='signin' className='w-full'>
              <TabsList className='w-full'>
                <TabsTrigger value='signin'>Iniciar Sesión</TabsTrigger>
                <TabsTrigger value='signup'>Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value='signin' className='space-y-4'>
                <form onSubmit={handleSignIn} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='signin-email'>Email</Label>
                    <Input
                      id='signin-email'
                      type='email'
                      placeholder='tu@email.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='signin-password'>Contraseña</Label>
                    <div className='relative'>
                      <Input
                        id='signin-password'
                        type={showPassword ? 'text' : 'password'}
                        placeholder='••••••••'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className='h-4 w-4' />
                        ) : (
                          <Eye className='h-4 w-4' />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type='submit' className='w-full' disabled={loading}>
                    {loading ? (
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    ) : (
                      <LogIn className='h-4 w-4 mr-2' />
                    )}
                    Iniciar Sesión
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value='signup' className='space-y-4'>
                <form onSubmit={handleSignUp} className='space-y-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='signup-email'>Email</Label>
                    <Input
                      id='signup-email'
                      type='email'
                      placeholder='tu@email.com'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='signup-password'>Contraseña</Label>
                    <div className='relative'>
                      <Input
                        id='signup-password'
                        type={showPassword ? 'text' : 'password'}
                        placeholder='••••••••'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className='h-4 w-4' />
                        ) : (
                          <Eye className='h-4 w-4' />
                        )}
                      </Button>
                    </div>
                    {password.length < 6 && (
                      <p className='text-xs text-gray-500'>
                        Mínimo 6 caracteres
                      </p>
                    )}
                  </div>
                  <Button type='submit' className='w-full' disabled={loading}>
                    {loading ? (
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    ) : (
                      <LogIn className='h-4 w-4 mr-2' />
                    )}
                    Crear Cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className='bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800'>
              <div className='flex items-start gap-2'>
                <Shield className='h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0' />
                <div className='text-sm text-blue-800 dark:text-blue-200'>
                  <p className='font-medium mb-1'>Seguridad garantizada</p>
                  <p className='text-blue-700 dark:text-blue-300'>
                    Tus datos financieros están protegidos con encriptación de
                    nivel bancario.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

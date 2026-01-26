'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, Shield, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import Logo from '../assets/images/logo.svg';
import GoogleLogo from '../assets/images/googleLogo.svg';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Error',
        description:
          'No se pudo realizar el inicio de sesion del usuario. Intente mas tarde.',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo realizar el registro del usuario.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Éxito',
        description:
          '¡Cuenta creada! Revisa tu email para confirmar tu cuenta.',
      });
      setCooldown(60);
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);

    const { error } = await signInWithGoogle();

    if (error) {
      toast({
        title: 'Error',
        description:
          'No se pudo realizar el inicio de sesion con Google. Intente mas tarde.',
        variant: 'destructive',
      });
      setLoading(false);
    }
    // No establecemos loading a false aquí porque la redirección a Google manejará eso
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-950 dark:via-emerald-950/20 dark:to-gray-950 p-4'>
      {/* Decorative background elements */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl' />
        <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400/20 rounded-full blur-3xl' />
      </div>

      <div className='relative w-full max-w-md space-y-8'>
        <div className='text-center space-y-4'>
          <div className='flex justify-center'>
            <div className='relative'>
              <div className='absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full blur-xl opacity-50' />
              <Image src={Logo} width={88} height={88} alt='Personal Wallet logo' className='relative' />
            </div>
          </div>
          <div>
            <h1 className='text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent'>
              Personal Wallet
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-2'>
              Gestiona tus finanzas de manera inteligente
            </p>
          </div>
        </div>

        <Card className='shadow-xl shadow-emerald-500/5 border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl'>
          <CardHeader className='space-y-1 pb-4'>
            <CardTitle className='text-2xl text-center font-bold'>Bienvenido</CardTitle>
            <CardDescription className='text-center'>
              Inicia sesión o crea una cuenta nueva
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <Button
              type='button'
              variant='outline'
              className='w-full h-12 text-base border-2 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-gray-900'
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className='h-5 w-5 animate-spin mr-3' />
              ) : (
                <Image src={GoogleLogo} width={22} height={22} alt='Google logo' className='mr-2'/>
              )}
              Continuar con Google
            </Button>
            <div className='relative py-2'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t border-gray-200 dark:border-gray-700' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-white/80 dark:bg-gray-900/80 px-4 text-gray-500 font-medium'>
                  O continúa con email
                </span>
              </div>
            </div>

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
                      autoComplete='email'
                      inputMode='email'
                      spellCheck={false}
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
                        autoComplete='current-password'
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className='h-4 w-4' aria-hidden="true" />
                        ) : (
                          <Eye className='h-4 w-4' aria-hidden="true" />
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
                      autoComplete='email'
                      inputMode='email'
                      spellCheck={false}
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
                        autoComplete='new-password'
                      />
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className='h-4 w-4' aria-hidden="true" />
                        ) : (
                          <Eye className='h-4 w-4' aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    {password.length < 6 && (
                      <p className='text-xs text-gray-500'>
                        Mínimo 6 caracteres
                      </p>
                    )}
                  </div>
                  <Button
                    type='submit'
                    className='w-full'
                    disabled={loading || cooldown > 0}
                  >
                    {loading ? (
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    ) : (
                      <LogIn className='h-4 w-4 mr-2' />
                    )}
                    {cooldown > 0 ? `Espera ${cooldown}s...` : 'Crear Cuenta'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className='bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50'>
              <div className='flex items-start gap-3'>
                <div className='p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg'>
                  <Shield className='h-4 w-4 text-emerald-600 dark:text-emerald-400' aria-hidden="true" />
                </div>
                <div className='text-sm'>
                  <p className='font-semibold text-emerald-800 dark:text-emerald-200 mb-1'>Seguridad garantizada</p>
                  <p className='text-emerald-700 dark:text-emerald-300 leading-relaxed'>
                    Tus datos financieros están protegidos con encriptación de
                    nivel bancario.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className='text-center text-sm text-gray-500 dark:text-gray-400'>
          Al continuar, aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </div>
    </div>
  );
}
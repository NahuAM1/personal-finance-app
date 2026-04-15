# Personal Finance — Mobile (Expo)

App móvil del proyecto `personal-finance-app`. Convive con el deploy de Vercel del web: `.vercelignore` en la raíz excluye `mobile/`, y `tsconfig.json` del web excluye `mobile/**`.

## Setup

```bash
cd mobile
cp .env.example .env
# Completar EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL
npm install
npx expo start
```

## Stack

- Expo SDK 54 + Expo Router (file-based, calca `app/` de Next)
- React 19 + React Native 0.81 (new architecture)
- NativeWind v4 (Tailwind en RN)
- Supabase JS + SecureStore para persistir sesión
- Google OAuth via `signInWithOAuth` con deep link `personalfinance://auth/callback`
- sonner-native (toasts), lucide-react-native (iconos), date-fns

## Estructura

```
app/
  _layout.tsx          # Root: providers + Stack
  index.tsx            # Redirect según auth
  (auth)/              # Rutas públicas (login, register, reset-password)
  (app)/               # Rutas protegidas
    (tabs)/            # Dashboard, Transacciones, Cuotas, Inversiones, Historial
contexts/auth-context.tsx
lib/supabase.ts        # Cliente RN con SecureStore
types/database.ts      # Verbatim del web
```

## Fases

1. **Fase 0** ✓ Scaffold, NativeWind, env, Supabase client, tsconfig exclude en web
2. **Fase 1** En curso — Auth flow + Shell
3. **Fase 2** Dashboard + charts
4. **Fase 3** Transacciones + historial
5. **Fase 4** Cuotas / préstamos / inversiones
6. **Fase 5** IA voz + SmartPocket

## Backend

La app consume las API routes del Next.js web (ver `EXPO_PUBLIC_API_BASE_URL`). Las rutas deben aceptar `Authorization: Bearer <jwt>` del usuario Supabase — validar esto antes de Fase 5.

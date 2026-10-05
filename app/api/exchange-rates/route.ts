import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isArsRateType, isSupportedCurrency } from '@/lib/currency/currencies';
import { argentinaToday, getRate, RateUnavailableError } from '@/lib/exchange-rates/service';
import { isValidDateString } from '@/lib/exchange-rates/http';

const MIN_DATE = '2011-01-01';

function addOneDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const date = params.get('date') ?? '';
  const type = params.get('type') ?? 'oficial';

  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
    return NextResponse.json({ error: 'Moneda no soportada' }, { status: 400 });
  }
  if (!isArsRateType(type)) {
    return NextResponse.json({ error: 'Tipo de cotización inválido' }, { status: 400 });
  }
  if (!isValidDateString(date) || date < MIN_DATE || date > addOneDay(argentinaToday())) {
    return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  }

  try {
    const result = await getRate(from, to, date, type);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateUnavailableError) {
      return NextResponse.json(
        { error: 'No hay cotización disponible. Ingresala manualmente.' },
        { status: 503 }
      );
    }
    console.error('Error fetching exchange rate:', error);
    return NextResponse.json({ error: 'No se pudo obtener la cotización' }, { status: 500 });
  }
}

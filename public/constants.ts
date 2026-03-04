export const expenseCategories = [
  'Compras',
  'Servicios',
  'Salidas',
  'Delivery',
  'Auto',
  'Transporte',
  'Deporte',
  'Entretenimiento',
  'Salud',
  'Ropa',
  'Tecnología',
  'Educación',
  'Hogar',
  'Otros',
];

export const incomeCategories = [
  'Salario',
  'Freelance',
  'Inversiones',
  'Alquiler',
  'Venta',
  'Bono',
  'Regalo',
  'Otros',
];

export const ticketItemCategories = [
  'Lácteos',
  'Carnes',
  'Frutas y Verduras',
  'Panadería',
  'Bebidas',
  'Limpieza',
  'Higiene',
  'Snacks',
  'Congelados',
  'Condimentos',
  'Almacén',
  'Otros',
];

export const formatCategories = (categories: string[]): string =>
  categories.map((c) => `"${c}"`).join(', ');

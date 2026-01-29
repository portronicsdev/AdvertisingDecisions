const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('🔍 SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('🔍 SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Loaded' : '❌ Missing');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,      // ✅ CRITICAL
    persistSession: false,        // ✅ Server-side
    detectSessionInUrl: false     // ✅ No browser behavior
  }
});

console.log('✅ Supabase SERVICE_ROLE client initialized');




(async () => {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    console.log('🔍 PRODUCTS COUNT:', count);
    
    if (error) throw error;
    if (!count || count === 0) {
      console.log('⚠️ No products found - upload data first');
    } else {
      console.log(`✅ ${count} products ready`);
    }
  } catch (err) {
    console.error('❌ Products check failed:', err.message);
  }
})();

module.exports = supabase;

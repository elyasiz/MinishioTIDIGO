export const categories = ['Stok / barang', 'Bahan produksi', 'Kemasan', 'Operasional', 'Lainnya'];
export const emptyLedger = () => ({ transactions: [], imports: [], audit: [], opening: null, completedMonths: [], updatedAt: null });
export const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s; }
export function parseDate(value) {
  const s = String(value || '').trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/);
  const local = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})(?:\s.*)?$/);
  const result = iso?.[1] || (local ? `${local[3]}-${local[2]}-${local[1]}` : '');
  if (!validDate(result)) throw new Error('Tanggal harus YYYY-MM-DD atau DD/MM/YYYY.');
  return result;
}
export function parseMoney(value) {
  let s = String(value ?? '').trim().replace(/^Rp\.?\s*/i, '').replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,00)?$/.test(s)) s = s.replaceAll('.', '').replace(/,00$/, '');
  else if (/^\d+(,00|\.00)$/.test(s)) s = s.slice(0,-3);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) > 1e12) throw new Error('Nominal tidak valid; gunakan rupiah bulat.');
  return Number(s);
}
function fields(line, delimiter) {
  const out = []; let cell = '', quoted = false;
  for (let i=0;i<line.length;i++) {
    const c = line[i];
    if (c === '"') { if (quoted && line[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { out.push(cell.trim()); cell = ''; } else cell += c;
  }
  if (quoted) throw new Error('Tanda kutip pada baris tidak lengkap.');
  out.push(cell.trim()); return out;
}
const headerKey = value => value.toLowerCase().replace(/[^a-z0-9]/g,'');
const columnNames = {
 id:['id','transactionid','idtransaksi','nomortransaksi','notransaksi','orderid','idpesanan','nomorreferensi','referenceid'],
 date:['tanggal','date','transactiondate','tanggaltransaksi','transactiondatetime','transactiontime','waktutransaksi','tanggaldanwaktu','tanggalwaktu','paymentdate'],
 amount:['nominal','amount','grossamount','jumlah','total','transactionamount','nominaltransaksi','jumlahtransaksi','totaltransaksi','gross','bruto','nominalbruto','jumlahbruto','pendapatankotor'],
 net:['net','netamount','nettamount','nettransactionamount','netincome','bersih','nominalbersih','jumlahbersih','pendapatanbersih','penerimaanbersih','totalbersih'],
 status:['status','transactionstatus','statustransaksi','paymentstatus','statuspembayaran'],
 description:['keterangan','description','deskripsi'],
 fee:['biaya','fee','mdr','servicefee','transactionfee','biayalayanan','biayatransaksi','biayaadmin','biayamdr','mdramount','totalfee'],
 kind:['transactiontype','jenistransaksi','tipetransaksi','type']
};
const matches = (headers,key) => headers.flatMap((h,i)=>columnNames[key].includes(headerKey(h))?[i]:[]);
export function readTable(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Laporan maksimal 2 MB.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.trim());
  if (lines.length < 2) throw new Error('Laporan perlu baris judul kolom dan minimal satu transaksi.');
  // A report may begin with a title or merchant information above the table.
  let headerIndex=0, delimiter=null, headers=null;
  for(let i=0;i<Math.min(lines.length-1,20)&&!headers;i++) {
    for(const candidate of ['\t',';','|',',']) {
      let cells;try{cells=fields(lines[i],candidate);}catch{continue;}
      if(cells.length>=3&&matches(cells,'id').length&&matches(cells,'date').length&&(matches(cells,'amount').length||matches(cells,'net').length)) {headers=cells;delimiter=candidate;headerIndex=i;break;}
    }
  }
  if(!headers){delimiter=['\t',';','|',','].sort((a,b)=>fields(lines[0],b).length-fields(lines[0],a).length)[0];headers=fields(lines[0],delimiter);}
  if (headers.length < 3 || new Set(headers).size !== headers.length) throw new Error('Format belum dikenali. Gunakan tabel TXT dengan judul kolom unik dan pemisah tab, titik koma, koma, atau |.');
  if (lines.length > 10001) throw new Error('Maksimal 10.000 transaksi per impor.');
  const rows = lines.slice(headerIndex+1).map((line, index) => { try { return { line: index+headerIndex+2, values: fields(line, delimiter) }; } catch(e) { return {line:index+headerIndex+2, values:[], error:e.message}; } });
  const mapping = Object.fromEntries(Object.keys(columnNames).map(key=>[key,String(matches(headers,key)[0]??-1)]));
  return {headers, rows, mapping};
}
export function parseAutomaticReport(text,existing=[]) {
  const {headers,mapping}=readTable(text);
  for(const key of ['id','date','status','amount','net','fee','kind']) {
    if(matches(headers,key).length>1) throw new Error('Format laporan belum dapat dibaca otomatis: ada beberapa kolom '+({id:'ID',date:'tanggal',status:'status',amount:'nominal',net:'nominal bersih',fee:'biaya',kind:'jenis transaksi'}[key])+'. Tidak ada transaksi yang disimpan. Kirim contoh laporan agar formatnya dapat disesuaikan.');
  }
  const missing=['id','date','status'].filter(key=>mapping[key]==='-1');
  if(mapping.amount==='-1'&&mapping.net==='-1')missing.push('amount');
  if(missing.length)throw new Error('Format laporan belum dikenali otomatis ('+missing.map(k=>({id:'ID transaksi',date:'tanggal',status:'status',amount:'nominal'}[k])).join(', ')+'). Tidak ada transaksi yang disimpan. Kirim contoh report.txt agar formatnya dapat disesuaikan.');
  const amountMode=mapping.net!=='-1'?'net':'gross';
  const selected={...mapping,...(amountMode==='net'?{amount:mapping.net,gross:mapping.amount}: {})};
  const result=parseReport(text,selected,existing,amountMode);
  return {...result,amountMode};
}
export function parseReport(text, mapping, existing = [], amountMode = 'gross') {
  const table = readTable(text);
  for (const key of ['id','date','amount','status']) if (!/^\d+$/.test(String(mapping?.[key])) || Number(mapping[key]) >= table.headers.length) throw new Error('Pilih kolom ID, tanggal, nominal, dan status terlebih dahulu.');
  const selected = ['id','date','amount','status','fee'].map(k=>mapping[k]).filter(v=>v !== undefined && v !== '-1');
  if (new Set(selected.map(String)).size !== selected.length) throw new Error('Setiap informasi harus menggunakan kolom yang berbeda.');
  if (!['gross','net'].includes(amountMode)) throw new Error('Dasar nominal tidak valid.');
  const seen = new Set(existing.filter(t=>t.source==='GoPay' && !t.voided).map(t=>t.reference));
  const result = { valid: [], duplicates: [], errors: [], excluded: [] };
  for (const row of table.rows) {
    try {
      if (row.error || row.values.length !== table.headers.length) throw new Error(row.error || 'Jumlah kolom tidak sesuai.');
      const get = k => row.values[Number(mapping[k])] || '';
      if(mapping.kind!==undefined&&mapping.kind!=='-1') {
        const kind=get('kind').toLowerCase().trim();
        if(!['sale','sales','payment','qris','qris payment','penjualan','pembayaran','pembayaran qris'].includes(kind))throw new Error('Jenis transaksi bukan penjualan yang dikenali. Refund atau pencairan tidak dihitung otomatis.');
      }
      const reference = get('id').trim(); if (!reference || reference.length>160) throw new Error('ID transaksi kosong atau terlalu panjang.');
      const date = parseDate(get('date'));
      const status = get('status').toLowerCase().trim();
      if (['pending','tertunda','failed','gagal','cancelled','canceled','dibatalkan'].includes(status)) { result.excluded.push({line:row.line, reason:`Status ${status}`}); continue; }
      if (!['success','successful','berhasil','paid','settlement','sukses','completed'].includes(status)) throw new Error(`Status "${status}" perlu diperiksa. Refund/pencairan tidak diimpor otomatis.`);
      const raw = parseMoney(get('amount'));
      const fee = mapping.fee !== '-1' && mapping.fee !== undefined && get('fee') !== '' ? parseMoney(get('fee')) : null;
      const amount = amountMode === 'gross' ? raw - (fee || 0) : raw;
      const explicitGross = amountMode==='net'&&mapping.gross!==undefined&&mapping.gross!=='-1' ? parseMoney(get('gross')) : null;
      if(explicitGross!==null&&(explicitGross<amount||(fee!==null&&explicitGross-fee!==amount)))throw new Error('Nominal bruto, biaya, dan bersih tidak sesuai.');
      if (raw <= 0 || amount <= 0) throw new Error('Nominal bersih harus lebih besar dari nol.');
      const transaction = { reference, date, amount, gross:amountMode==='gross'?raw:(explicitGross??(fee === null ? null : raw+fee)), fee, description:'Penjualan QRIS', type:'income', category:'Penjualan QRIS', source:'GoPay', line:row.line };
      if (seen.has(reference)) result.duplicates.push(transaction);
      else { seen.add(reference); result.valid.push(transaction); }
    } catch(e) { result.errors.push({line:row.line, reason:e.message}); }
  }
  return result;
}
export function totals(ledger, month) {
  const active = ledger.transactions.filter(t=>!t.voided);
  const start = month+'-01'; const end = month+'-31';
  const rows = active.filter(t=>t.date.startsWith(month));
  const income = rows.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = rows.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const openingKnown = ledger.opening && ledger.opening.date <= start;
  const before = active.filter(t=>t.date < start && t.date >= (ledger.opening?.date || '0000')).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
  return {income,expense,rows,balance:openingKnown?ledger.opening.amount+before+income-expense:null, opening:openingKnown?ledger.opening.amount+before:null, end};
}
export function demoLedger() {
  const month = today().slice(0,7), result = emptyLedger();
  const values=[75000,125000,85000,180000,65000,250000,120000,95000,165000,85000,225000,145000,175000,90000,280000,125000,155000,215000];
  result.transactions=values.map((amount,i)=>({id:`demo-${i}`,reference:`DEMO-${i}`,date:`${month}-${String(i+1).padStart(2,'0')}`,amount,gross:amount,fee:0,description:'Penjualan QRIS',category:'Penjualan QRIS',type:'income',source:'GoPay'}));
  result.transactions.push(...[[3,320000,'Bahan produksi','Filamen PLA — 2 roll'],[8,85000,'Kemasan','Kotak & stiker kemasan'],[13,175000,'Stok / barang','Ring gantungan & aksesori'],[17,65000,'Operasional','Kebutuhan minishop']].map(([day,amount,category,description],i)=>({id:`demo-exp-${i}`,date:`${month}-${String(day).padStart(2,'0')}`,amount,category,description,type:'expense',source:'Manual'})));
  result.opening={date:month+'-01',amount:500000}; result.updatedAt=new Date().toISOString(); return result;
}

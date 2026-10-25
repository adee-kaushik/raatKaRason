'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle,ShieldCheck,ArrowRight,Package,PhoneCall,MessageCircle,Phone} from 'lucide-react';
import {money,statusLabels} from '../lib/store';

export function getOwnerWhatsAppUrl(order, customer, items, ownerPhone = '9996301793') {
 const ref = order?.id ? `#${order.id.slice(0,8).toUpperCase()}` : 'NEW ORDER';
 const lines = [
  `🛍️ *NEW ORDER - Raat Ka Rason*`,
  `----------------------------------`,
  `📋 *Order ID:* ${ref}`,
  customer?.name ? `👤 *Customer:* ${customer.name}` : '',
  customer?.phone ? `📞 *Phone:* ${customer.phone}` : '',
  customer?.hostel ? `🏢 *Hostel:* ${customer.hostel}` : '',
  customer?.room ? `🚪 *Room:* ${customer.room}` : '',
  customer?.notes ? `📝 *Notes:* ${customer.notes}` : '',
  `----------------------------------`,
  `🛒 *Items Ordered:*`,
  ...(items || []).map(i => `• ${i.quantity}x ${i.name || i.id} (₹${(i.price || i.unit_price || 0) * i.quantity})`),
  `----------------------------------`,
  order?.total ? `💰 *Total Amount:* ₹${order.total} (Cash on Delivery)` : '',
  `----------------------------------`,
  `Please confirm my late-night order! 🙏`
 ].filter(Boolean).join('\n');
 return `https://wa.me/91${ownerPhone}?text=${encodeURIComponent(lines)}`;
}

export function Checkout({lines,cart,settings,subtotal,isPreview,onSuccess,onBusy,onRefresh,onBack}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const attempt=useRef(null);
 async function submit(e){
  e.preventDefault();
  setError('');
  setBusy(true);
  onBusy(true);
  const form=new FormData(e.currentTarget);
  const customer={
   name:String(form.get('name')).trim(),
   phone:String(form.get('phone')).trim(),
   hostel:String(form.get('hostel')),
   room:String(form.get('room')).trim(),
   notes:String(form.get('notes')).trim()
  };
  const items=lines.map(p=>({id:p.id,name:p.name,size:p.size,quantity:cart[p.id],price:p.price})).sort((a,b)=>a.id.localeCompare(b.id));
  const payload={customer,items,deliveryFee:settings.delivery_fee};
  const signature=JSON.stringify(payload);
  if(attempt.current?.signature!==signature)attempt.current={signature,key:crypto.randomUUID()};
  try{
   const res=await fetch('/api/orders',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,key:attempt.current.key})});
   const data=await res.json();
   if(!res.ok){
    if(res.status===409)await onRefresh();
    throw new Error(data.error);
   }
   onSuccess(data.order, customer, items);
  }catch(e){
   setError(e.message||'Connection lost. Try again; the same order will not be placed twice.');
  }finally{
   setBusy(false);
   onBusy(false);
  }
 }
 const blocked=isPreview||!settings.is_open||!settings.hostels.length||subtotal<settings.minimum_order;
 return <form className="checkout-form" onSubmit={submit}>
  <h3>Your hostel doorstep, please.</h3>
  <p className="checkout-note">No account needed. We use these details only to fulfil your order.</p>
  <Field label="Your name"><input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="Full name"/></Field>
  <Field label="Mobile number"><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit Indian mobile number"/></Field>
  <div className="form-grid">
   <Field label="Hostel"><select name="hostel" required defaultValue=""><option value="" disabled>Choose your hostel</option>{settings.hostels.map(h=><option key={h}>{h}</option>)}</select></Field>
   <Field label="Room number"><input name="room" required maxLength={30} placeholder="e.g. B-204"/></Field>
  </div>
  <Field label="Delivery note (optional)"><textarea name="notes" rows={2} maxLength={500} placeholder="Anything we should know?"/></Field>
  <p className="checkout-note">{settings.delivery_note}</p>
  <div className="checkout-payment"><ShieldCheck size={23}/><div><b>Cash on delivery</b><p>Pay when your snacks arrive.</p></div></div>
  <div className="checkout-fee"><span>Delivery fee</span><b>{money(settings.delivery_fee)}</b></div>
  <div className="cart-total"><span>Total to pay</span><b>{money(subtotal+settings.delivery_fee)}</b></div>
  {blocked&&<p className="form-notice">{isPreview?'This preview cannot accept orders.':!settings.is_open?settings.closed_message:!settings.hostels.length?'Delivery hostels are being configured.':`Minimum order is ${money(settings.minimum_order)}.`}</p>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button className="primary full" disabled={busy||blocked}>{busy?'Placing your order…':`Place order · ${money(subtotal+settings.delivery_fee)}`}<ArrowRight size={16}/></button>
  <button type="button" className="secondary full" disabled={busy} onClick={onBack}>Back to my bag</button>
 </form>;
}
function Field({label,children}){return <label className="checkout-field"><span>{label}</span>{children}</label>;}

export function OrderStatus({token,lastOrder,settings,onClose}){
 const [order,setOrder]=useState(null),[error,setError]=useState('');
 const ownerPhone=settings?.contact_phone||'9996301793';
 useEffect(()=>{
  let active=true;
  async function refresh(){
   try{
    const res=await fetch('/api/orders/'+token,{cache:'no-store'});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error);
    if(active){setOrder(data.order);setError('');}
   }catch(e){if(active)setError(e.message);}
  }
  refresh();
  const t=setInterval(()=>{if(document.visibilityState==='visible')refresh();},10000);
  return()=>{active=false;clearInterval(t);};
 },[token]);

 const steps=['pending','accepted','packing','out_for_delivery','delivered'];
 const stage=steps.indexOf(order?.status);
 const effectiveOrder=order||lastOrder?.order;
 const waUrl=getOwnerWhatsAppUrl(effectiveOrder,lastOrder?.customer,effectiveOrder?.items||lastOrder?.items,ownerPhone);

 return <div className="order-success">
  <CheckCircle size={44}/>
  <h3>{order?statusLabels[order.status]:'Order placed successfully!'}</h3>
  <p>Thanks for choosing Raat Ka Rason. Your order has been registered.</p>

  <div className="owner-popup-card">
   <div className="owner-popup-badge"><PhoneCall size={14}/> STORE OWNER HELPLINE</div>
   <h4>Need to confirm or have quick questions?</h4>
   <p>Call or WhatsApp the owner directly:</p>
   <div className="owner-phone-number">{ownerPhone}</div>
   <div className="owner-popup-actions">
    <a href={`tel:${ownerPhone}`} className="owner-call-btn">
     <Phone size={15}/> Call Owner ({ownerPhone})
    </a>
    <a href={waUrl} target="_blank" rel="noreferrer" className="owner-whatsapp-btn">
     <MessageCircle size={15}/> Send Order on WhatsApp
    </a>
   </div>
  </div>

  {error&&<p className="form-error" role="alert">{error}</p>}
  {effectiveOrder&&<>
   <div className="order-reference">#{effectiveOrder.id?.slice(0,8).toUpperCase()}</div>
   <p>{effectiveOrder.status==='cancelled'?'This order was cancelled. Its items were returned to stock.':effectiveOrder.status==='delivered'?`Delivered · ${money(effectiveOrder.total)} cash collected`:`Pay ${money(effectiveOrder.total)} in cash on delivery.`}</p>
   {effectiveOrder.status!=='cancelled'&&<div className="order-progress">{steps.map((s,i)=><div className={`order-step ${i<=stage?'done':''}`} key={s}><span>{i<=stage?'✓':i+1}</span>{statusLabels[s]}</div>)}</div>}
   {effectiveOrder.items?.map((i,k)=><p key={k}>{i.quantity} × {i.name} · {money((i.price||i.unit_price||0)*i.quantity)}</p>)}
  </>}
  <p className="checkout-note">You can find this order under “My orders” on this device. Save your order reference for support.</p>
  <button className="primary full" onClick={onClose}>Back to the snack stash <ArrowRight size={16}/></button>
 </div>;
}


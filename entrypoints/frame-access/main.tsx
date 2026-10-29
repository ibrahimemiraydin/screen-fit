import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {browser} from 'wxt/browser';
import {translate,type Message} from '../../src/i18n';
import {useLanguage} from '../../src/use-language';
import './style.css';
const params=new URLSearchParams(location.search),tabId=Number(params.get('tabId')),session=params.get('session');
function App(){
 const language=useLanguage(),t=(key:Message)=>translate(language,key);
 const [origins,setOrigins]=useState<string[]>([]),[status,setStatus]=useState<Message>('Oynatıcı bilgisi alınıyor…'),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>{document.documentElement.lang=language;document.title=`Screen Fit · ${t('Gömülü oynatıcı erişimi')}`;},[language]);
 useEffect(()=>{if(!tabId||!session){setStatus('Bu sayfayı büyütülmüş videodaki oynatıcı erişimi düğmesinden açın.');return;}void browser.runtime.sendMessage({type:'screen-fit:frame-access-info',tabId,session}).then(info=>{if(info?.expired){setStatus('Video oturumu sona ermiş. Videoyu tekrar büyütün.');return;}setOrigins(info?.origins??[]);setStatus('İzin verirseniz görüntü ölçeği ve iframe içinde Esc etkinleşir.');}).catch(()=>setStatus('Oynatıcı bilgisi alınamadı.'));},[]);
 async function grant(){
  setBusy(true);
  try {
   // Must be called directly from this extension page's button gesture.
   const allowed=await browser.permissions.request({origins});
   if(!allowed){setStatus('İzin verilmedi. Araç çubuğundaki Çık düğmesini kullanabilirsiniz.');return;}
   const result=await browser.runtime.sendMessage({type:'screen-fit:attach-escape',tabId,session});
   if(result?.status==='ready'){setDone(true);setStatus('Oynatıcı erişimi etkinleştirildi. Video sekmesine dönüp ölçeği ve Esc’yi deneyebilirsiniz.');}
   else if(result?.status==='permission-required'){setOrigins(result.origins??[]);setStatus('Oynatıcı başka bir adresten devam ediyor. Yeni adresleri kontrol edip izin verebilirsiniz.');}
   else setStatus(result?.status==='expired'?'Video oturumu sona ermiş. Videoyu tekrar büyütün.':'Oynatıcının tamamına erişilemedi. Videoyu kapatıp tekrar büyütün.');
  }catch{setStatus('İzin veya bağlantı işlemi tamamlanamadı. Video sekmesinden tekrar deneyin.');}finally{setBusy(false);}
 }
 return <main><span className="brand">⛶ Screen Fit</span><h1>{t("Görüntü ölçeği ve Esc,")}<br/>{t("oynatıcının içinde de çalışsın.")}</h1><p>{t("Bu oynatıcı farklı bir web adresinden yükleniyor. Görüntüsünü ölçeklemek ve Esc tuşunu orada algılamak için tarayıcınızın aşağıdaki adreslere erişim izni vermesi gerekiyor.")}</p><ul>{origins.map(o=><li key={o}>{new URL(o.replace('/*','/')).hostname}</li>)}</ul><p className="note">{t("Yalnızca bu oynatıcı adresleri istenir. Betik, video büyütüldüğünde çalışır; tuşları kaydetmez. İzni daha sonra uzantının site erişimi ayarlarından kaldırabilirsiniz.")}</p><div role="status">{t(status)}</div><div className="actions">{!done&&<button disabled={busy||!origins.length} onClick={()=>void grant()}>{busy?t("Bekleniyor…"):t("İzin ver ve etkinleştir")}</button>}<button className="secondary" disabled={!tabId} onClick={()=>void browser.tabs.update(tabId,{active:true})}>{t("Video sekmesine dön")}</button></div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

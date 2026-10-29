# Screen Fit

**Videolar için sekme içi tam ekran.** Video mevcut sekmeye yayılırken sekmeleriniz ve adres çubuğunuz görünür kalır.

[English](README.md) · [Değişiklikler](CHANGELOG.md) · [Gizlilik](PRIVACY.tr.md)

![Screen Fit video paneli](.github/assets/toolbar.png)

## Kurulum

1. [Releases](https://github.com/ibrahimemiraydin/screen-fit/releases) bölümünden Chrome ZIP paketini indirip çıkarın.
2. Tarayıcının uzantılar sayfasında **Geliştirici modu**nu etkinleştirin.
3. **Paketlenmemiş öğe yükle** ile `manifest.json` içeren klasörü seçin. Yerel derlemede klasör `.output/chrome-mv3` olur.
4. Screen Fit'i sabitleyin; video görünürken simgeye tıklayın.

Bu paket Chrome Web Mağazası yayını değildir. Güncellemeden sonra uzantıyı ve açık video sekmelerini yenileyin.

## Özellikler

- Akıllı, manuel veya en büyük video seçimi.
- Fit / Fill; **%25–%300 görüntü ölçeği** ve **%25–%100 oynatıcı boyutu**.
- Özel kaydırıcılar, yüzde alanları ve artır/azalt okları; otomatik gizlenen panel.
- Options'tan kalıcı Türkçe / İngilizce seçimi ve varsayılan ölçekler.
- Video bulunamaması, ekran dışında kalması, gömülü algılamanın kapalı olması ve olası özel oynatıcılar için uyumluluk kartları.
- Uygun iframe oynatıcılarında ölçek ve Esc için isteğe bağlı, ilgili adresleri kapsayan erişim.

Tekrar tıklama, Esc veya **Çık** ile eski düzene dönün. Paneli geri getirmek için fareyi sekmenin üst kenarına götürün. **Alt+Shift+F** büyütür / geri yükler; **Alt+Shift+V** seçim başlatır. Dairesel ok iki ölçeği %100 yapar. İzlerken yapılan değişiklikler oturuma, Options değerleri sonraki açılışların varsayılanlarına aittir.

Uyumluluk kartında **Yeniden dene** sayfayı tekrar tarar. Gömülü algılama kapalıysa **Ayarları aç** ile tercihi değiştirebilirsiniz. **Oynatıcı erişimini etkinleştir** yalnızca gerektiğinde ek adres izni ister; izin vermeden de dış boyut ve Çık kullanılabilir.

## Uyumluluk ve gizlilik

Her sitede çalışma garantisi yoktur. Özel oynatıcı mesajı kesin teşhis değildir. Kapalı Shadow DOM, DRM, reklam geçişleri, iframe kısıtları ve özel çizim katmanları desteği sınırlayabilir. Korumalı tarayıcı sayfalarına müdahale edilemez. Görüntü ölçeği CSS `object-view-box` desteği gerektirir.

Hesap, sunucu, harici API, telemetri veya izleme geçmişi toplama yoktur. Uyumluluk bilgisi sayfada kalır; dışarıya gönderilmez. İzinler `activeTab`, `scripting`, `storage`, `webNavigation` ve kullanıcı onayıyla seçilen oynatıcı adreslerine isteğe bağlı erişimdir. Zorunlu site erişimi veya otomatik üretim content script kaydı yoktur. Ayrıntılar [gizlilik bildirimindedir](PRIVACY.tr.md).

## Geliştirme

Node.js 24 ile `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run zip` kullanılabilir. Testler Windows'ta Edge'i varsayar; farklı Chromium çalıştırılabilir dosyası için `SCREEN_FIT_BROWSER_PATH` ayarlanabilir.

Yerel testler gerçek sitelerde kusursuz çalışma kanıtı değildir. Testlere geçici verilen sağlayıcı izinleri üretim manifestine eklenmez. Gerçek izin onayı, araç çubuğu / activeTab akışı ve farklı tarayıcılar ayrıca denenmelidir.

## Lisans

**UNLICENSED.** Kaynaklar herkese görünürdür; açık kaynak lisansı seçilmemiştir. Bağımlılıklar kendi lisanslarına tabidir.

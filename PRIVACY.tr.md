# Screen Fit gizlilik bildirimi

Screen Fit kişisel veri toplamaz, paylaşmaz ve dışarıya veri göndermez. Hesap, analiz servisi ve uzaktan çalışan servis kullanmaz.

Türkçe / İngilizce dil seçimi yalnızca cihazdaki yerel tercih olarak saklanır. Çeviriler uzantının içindedir; çeviri için dışarıya istek gönderilmez.

Kullanıcı eylemiyle aktif sayfada video öğeleri ve bunların boyut, görünürlük, oynatma durumu gibi özellikleri geçici olarak incelenir. Bu bilgiler tarama geçmişi olarak saklanmaz. Seçim yöntemi, Fit/Fill, çerçeve rengi ve bildirim tercihleri yalnızca cihazdaki `chrome.storage.local` alanında tutulur. Uzantı kaldırıldığında bu veriler tarayıcı tarafından silinir.

İzinler: `activeTab` kullanıcının çağırdığı sekmeye geçici erişim; `scripting` video görünümünü değiştiren betiği çalıştırma; `storage` tercihleri saklama; `webNavigation` yalnızca büyütülmüş oynatıcının iframe kimliğini ve alt çerçevelerini bulma. Sürekli gezinme takibi yapılmaz.

Iframe içinde Esc ve görüntü ölçeği desteği için kullanıcı isteğe bağlı alan adı erişimi verebilir. Tüm siteler için zorunlu erişim istenmez. İzin sayfası yalnızca seçilen oynatıcı ve uygun alt çerçevelerinin alan adlarını gösterir. Onaylanan izinler tarayıcı tarafından saklanır; kullanıcı bunları uzantının site erişimi ayarlarından kaldırabilir. Bilinen reklam ve doğrulama çerçeveleri için izin istenmez.

Esc dinleyicisi ve görüntü ölçeği stilleri yalnızca aktif büyütme sırasında çalışır; tuş kaydı yapmaz ve diğer tuşları saklamaz / iletmez. Rastgele oturum anahtarı, gerekli alan adı desenleri, çerçeve kimlikleri ve görünüm değerleri geçici `storage.session` alanında tutulur; büyütmeden çıkışta, sayfa değiştiğinde veya sekme kapandığında temizlenir. Tam video adresleri bu kayda dahil edilmez. Ayarlardan seçilen varsayılan görüntü ölçeği ve oynatıcı boyutu yalnızca yerel tercihler olarak saklanır.

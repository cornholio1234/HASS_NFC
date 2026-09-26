> **Prototyp / nicht als fertiges Gehäuse empfohlen.** Der physische Test von rB zeigte abbrechende Displaystützen, zu schwache Rastung, eine unzureichend gehaltene Rückwand und Display-Spiel. r0/rA sind ältere Entwürfe; rC ist noch nicht umgesetzt.

# NFC-Jukebox – Gehäuse rA

**Prototyp für PLA. Außenmaß: 70 breit × 50 tief × 60 mm hoch.**
Display vorne, RC522 waagerecht unter dem Dach. Zwei Druckteile, keine Schrauben.
Gegenüber r0: 45°-Abstützung unter dem oberen RC522-Anschlag und 45°-Dach
über dem Griffloch. Gehäuse und Schnittstellen bleiben unverändert.

## Dateien und Druck

- `gehaeuse.stl`: mit der flachen Oberseite auf dem Druckbett bereits ausgerichtet.
- `einschub.stl`: Boden und Rückwand als ein Teil, bereits auf dem Boden ausgerichtet.
- `jukebox.scad`: editierbare Quelle für OpenSCAD 2021.01 oder neuer.
- `ansicht.png`, `montage.png`: Außenansicht und Explosionsdarstellung.

Ausgangspunkt: PLA, 0,2-mm-Schichten, 0,4-mm-Düse, 3 Wandlinien. Im Slicer
Stützen gezielt für den breiten Displayausschnitt und die seitlichen Öffnungen
vorsehen; kleine Führungen kontrollieren. Am Einschub sind die beiden bisherigen
waagerechten Überhänge jetzt durch 45°-Schrägen ersetzt.
Keine geschätzten Druckzeiten oder filamentabhängigen Temperaturen vorgegeben.

## Montage

1. Display bei entferntem Einschub von unten in die vorderen Führungen schieben.
   Die Führungen halten die äußeren Glasränder; die Platine liegt dahinter frei.
2. RC522 von hinten in die Dachführungen schieben, Antennenseite nach oben,
   Bauteile und angelötete Kabel nach unten. Der Schlitz ist 2,4 mm hoch.
3. Kabel innen verstauen. USB bleibt durch seitliche Öffnungen erreichbar;
   diese sind beidseitig vorgesehen, unabhängig von der Displayorientierung.
4. Einschub von hinten zuschieben. Seine Finger halten das Display von unten.
   Beide Rastarme rasten seitlich ein. Zum Öffnen durch die zwei unteren
   Seitenfenster nach innen drücken und am rückwärtigen Griffloch herausziehen.

## Geprüft / noch offen

Beide STL sind geschlossene, orientierte Netze mit jeweils einem Körper.
Geschlossene Passung und Einschubbewegung werden geometrisch geprüft; die
Rastnasen dürfen während des Einschiebens bewusst 0,45 mm nachgeben.

**Noch kein physischer Pass- oder Drucktest.** RC522-Dicke, Lötstellen und
Dupont-Stecker sind nicht vermessen. Dachstärke 1,2 mm, Platine darunter mit
0,8 mm nominellem Abstand. Lesbarkeit durch den Druck muss praktisch geprüft
werden. Oben ist eine ebene Auflage; eine ganze Karte steht seitlich über.

## Maßquellen

- [Waveshare-Zeichnung](https://docs.waveshare.com/assets/images/ESP32-S3-Touch-LCD-2-details-size-278bc3bf787fd611bc1c00415ceca7c9.webp):
  Glas 58,8 × 37,1 × 1,1 mm, PCB 48,2 × 35 mm. Keine Lochbildannahmen nötig.
- [Joy-IT RC522](https://joy-it.net/en/products/SBC-RFID-RC522): nominal 60 × 40 mm;
  die tatsächliche Nachbauvariante und 1,6-mm-PCB-Dicke sind Annahmen.

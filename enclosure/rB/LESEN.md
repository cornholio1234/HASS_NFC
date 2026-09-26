> **Prototyp / nicht als fertiges Gehäuse empfohlen.** Der physische Test von rB zeigte abbrechende Displaystützen, zu schwache Rastung, eine unzureichend gehaltene Rückwand und Display-Spiel. r0/rA sind ältere Entwürfe; rC ist noch nicht umgesetzt.

# NFC-Jukebox – Gehäuse rB

**Prototyp für PLA. Außenmaß: 70 breit × 50 tief × 60 mm hoch.**
Display vorne, RC522 waagerecht unter dem Dach. Zwei Druckteile, keine Schrauben.
Gegenüber rA: Gehäuse wird auf der FRONT gedruckt. Führungen, Seitenöffnungen
und Außenkanten sind auf diese Richtung mit 45°-Schrägen angepasst. Der Einschub
ist unverändert. Außenmaße bleiben gleich.

## Dateien und Druck

- `gehaeuse.stl`: mit der FRONT auf dem Druckbett bereits ausgerichtet.
  Im Slicer deshalb 70 × 60 mm Grundfläche und 50 mm Druckhöhe, nicht umdrehen.
- `einschub.stl`: Boden und Rückwand als ein Teil, bereits auf dem Boden ausgerichtet.
- `jukebox.scad`: editierbare Quelle für OpenSCAD 2021.01 oder neuer.
- `ansicht.png`, `montage.png`: Außenansicht und Explosionsdarstellung.

Ausgangspunkt: PLA, 0,2-mm-Schichten, 0,4-mm-Düse, 3 Wandlinien.
Für rB zunächst OHNE automatische Stützen slicen und die Schichtvorschau prüfen.
Der Displayausschnitt beginnt auf dem Druckbett: keine breite Brücke darüber.
Seitenöffnungen laufen in Druckrichtung spitz zu; Halteleisten wachsen über 45°.
Die Rastnasen am unveränderten Einschub haben einen kleinen lokalen Überstand.
Dies ist eine geometrische Optimierung, noch kein praktisch getesteter Druck.
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

**Physischer Test: Grundform passt, Halterungen und Verriegelung müssen überarbeitet werden; siehe Warnung oben.** RC522-Dicke, Lötstellen und
Dupont-Stecker sind nicht vermessen. Dachstärke 1,2 mm, Platine darunter mit
0,8 mm nominellem Abstand. Lesbarkeit durch den Druck muss praktisch geprüft
werden. Oben ist eine ebene Auflage; eine ganze Karte steht seitlich über.

## Maßquellen

- [Waveshare-Zeichnung](https://docs.waveshare.com/assets/images/ESP32-S3-Touch-LCD-2-details-size-278bc3bf787fd611bc1c00415ceca7c9.webp):
  Glas 58,8 × 37,1 × 1,1 mm, PCB 48,2 × 35 mm. Keine Lochbildannahmen nötig.
- [Joy-IT RC522](https://joy-it.net/en/products/SBC-RFID-RC522): nominal 60 × 40 mm;
  die tatsächliche Nachbauvariante und 1,6-mm-PCB-Dicke sind Annahmen.

// NFC jukebox enclosure rC - front-face-down print orientation, millimetres.
// Source: Waveshare ESP32-S3-Touch-LCD-2 dimension drawing.
// RC522 nominal 60x40 PCB; actual thickness/component keepouts need fit check.
// Coordinates: X width, Y front->rear, Z height. Front is Y=0.
// Use: openscad -D 'part="body"' -o body.stl jukebox.scad
fit = 0.15; // clamp clearance: 0 tight, 0.15 normal, 0.30 loose
key_fit = 0; // -0.15 for loose keys
part = "assembly"; // body, drawer, assembly, exploded, interference
$fn = 40;
W=70; D=50; H=60;
wall=2;
glass_w=58.8; glass_h=37.1; glass_t=1.1;
glass_x=(W-glass_w)/2; glass_z=(H-glass_h)/2;
glass_y=wall;
glass_gap=0.4;
rail_rear=glass_y+glass_t+glass_gap;
rc_w=60; rc_d=40; rc_t=1.6;
rc_x=(W-rc_w)/2; rc_y=(D-rc_d)/2;
rc_z=56.4;
clearance=0.3;
eps=0.02;

module box(x,y,z,dx,dy,dz){translate([x,y,z])cube([dx,dy,dz]);}

module shell(){
  difference(){
    // Chamfers grow at 45 degrees when printing with the front on the bed.
    linear_extrude(height=H)polygon([[2,0],[W-2,0],[W,2],[W,D-2],
      [W-2,D],[2,D],[0,D-2],[0,2]]);
    // Open bottom and rear, roof 1.2 mm. Side/front walls 2 mm.
    box(wall,wall,-eps,W-2*wall,D,H-1.2+eps);
    // Front bezel overlaps glass by 0.8 mm each edge.
    box(glass_x+0.8,-eps,glass_z+0.8,glass_w-1.6,wall+2*eps,glass_h-1.6);
    // USB opening on the right only, viewed from the display front.
    translate([W-wall-eps,0,0])rotate([90,0,90])
      linear_extrude(height=wall+2*eps)
        polygon([[5,22],[18,22],[26,30],[18,38],[5,38]]);

  }
}

module display_guides(){
  for(right=[false,true])translate([right ? W : 0,0,0])scale([right ? -1 : 1,1,1]){
    box(wall-eps,wall-eps,6,5.3-wall+eps,3.02,45.5);
    translate([0,0,glass_z+0.35])linear_extrude(height=glass_h-0.05)
      polygon([[1.98,3.5],[5.3,3.5],[8.8,7],[8.8,9.4],[1.98,9.4]]);
  }
  box(glass_x-clearance-eps,wall-eps,glass_z+glass_h+clearance,
      glass_w+2*clearance+2*eps,3.04,2.4);
}

// Each strip bears on an outer glass margin, outside the PCB envelope.
module strip(){
  translate([0,0,glass_z+0.4])linear_extrude(height=glass_h-0.8)
    polygon([[5.8,3.1+fit],[8.6,3.1+fit],[8.6,6.8],[5.8,4.0]]);
}
module strips(){
  strip();translate([W,0,0])mirror([1,0,0])strip();
}
module strips_print(){
  // Glass contact face down; both handed strips supplied as a pair.
  translate([-5.8,glass_z+glass_h-0.4,-3.1-fit])rotate([90,0,0])strip();
  translate([14.4,glass_z+glass_h-0.4,-3.1-fit])rotate([90,0,0])mirror([1,0,0])strip();
}

module rfid_guides(){
  // Board slides in from the open rear, antenna side up, solder joints down.
  // 2.4-mm channel for nominal 1.6-mm PCB. No metal or supports under antenna.
  for(right=[false,true]){
    x=right ? rc_x+rc_w+clearance : wall-eps;
    width=right ? W-wall-x+eps : rc_x-clearance-wall+eps;
    box(x,rc_y-clearance,55.2,width,D-wall-clearance-(rc_y-clearance),H-1.2-55.2+eps);
    ledge_x=right ? rc_x+rc_w-1.2 : wall-eps;
    ledge_w=right ? W-wall-ledge_x+eps : rc_x+1.2-wall+eps;
    box(ledge_x,rc_y-clearance,55.2,ledge_w,D-wall-clearance-(rc_y-clearance),1.2);
  }
  // Root the front stop in the front wall, avoiding a floating first layer.
  box(wall-eps,wall-eps,55.2,W-2*wall+2*eps,rc_y-clearance-wall+2*eps,H-1.2-55.2+eps);
}

module floor_guides(){
  for(right=[false,true]){
    x=right ? W-wall-2 : wall-eps;
    box(x,wall-eps,0,2+eps,D-2*wall-clearance+eps,0.6);
    box(x,wall-eps,3.1,2+eps,D-2*wall-clearance+eps,1.0);
  }
}

// Four transverse solid keys lock both upper and lower back corners.
module key_holes(){
  for(right=[false,true])translate([right ? W : 0,0,0])scale([right ? -1 : 1,1,1])
    for(z=[10,48]){
      box(-eps,41.4,z-1.6,9.4,5.2,3.2);
      box(-eps,39.6,z-1.75,1.12,8.8,3.5);
    }
}
module body(){difference(){
  union(){shell();display_guides();rfid_guides();floor_guides();}
  key_holes();
}}
module key(){
  linear_extrude(height=2.9)polygon([[0,-4],[1,-4],[1,-2.625-key_fit/2],
    [3,-2.6-key_fit/2],[8,-2.3],[8,2.3],[3,2.6+key_fit/2],
    [1,2.625+key_fit/2],[1,4],[0,4]]);
}
module keys(){
  for(right=[false,true])translate([right ? W : 0,0,0])scale([right ? -1 : 1,1,1])
    for(z=[10,48])translate([0,44,z-1.45])key();
}
module keys_print(){for(i=[0:3])translate([i*11,4,0])key();}
module drawer(){difference(){
  union(){
    box(2.3,2.3,0.9,W-4.6,D-2.3,1.9);
    box(2.3,48,0.9,W-4.6,2,57.6);
    // Continuous ribs connect all four key seats to floor and back.
    for(x=[4.3,W-8.5])box(x,39,2.7,4.2,9.02,51.3);
    // Broad display plinth replaces fragile individual fingers.
    box(5.8,2.3,2.7,W-11.6,7.7,glass_z-0.2-2.7);
    // RFID rear stop and self-supporting gusset.
    box(20,rc_y+rc_d+clearance,55.3,30,48-(rc_y+rc_d+clearance)+eps,3);
    translate([20,48,52.6])rotate([90,0,90])linear_extrude(height=30)
      polygon([[eps,0],[eps,2.72],[-2.7,2.72]]);
  }
  key_holes();
  // Rear grip: triangular roof, no long bridge.
  translate([27,50.1,7])rotate([90,0,0])linear_extrude(height=2.2)
    polygon([[0,0],[16,0],[16,5],[8,13],[0,5]]);
}}

module hardware(){
  color([0.12,0.16,0.19])box(glass_x,glass_y,glass_z,glass_w,glass_t,glass_h);
  color([0.08,0.65,0.64])box(glass_x+7.51,glass_y-0.03,glass_z+3.06,41.2,0.02,31);
  // PCB envelope; actual connector positions are deliberately not asserted.
  color([0.1,0.3,0.6])box((W-48.2)/2,glass_y+glass_t+1.5,(H-35)/2,48.2,1.6,35);
  color([0.08,0.35,0.62])box(rc_x,rc_y,rc_z,rc_w,rc_d,rc_t);
  // Approximate rear electronics keepout, for illustration only.
  color([0.55,0.55,0.55,0.3])box(11,6.2,14,48,15,32);
}

if(part=="body") translate([0,H,0])rotate([90,0,0])body();
else if(part=="drawer")translate([0,0,-0.9])drawer();
else if(part=="strips")strips_print();
else if(part=="keys")keys_print();
else if(part=="interference")intersection(){body();drawer();}
else if(part=="plate") {
  translate([0,0,0])translate([0,H,0])rotate([90,0,0])body();
  translate([80,0,-0.9])drawer();
  translate([0,70,0])keys_print();
  translate([80,65,0])strips_print();
}
else if(part=="strip_check")intersection(){body();strips();}
else if(part=="travel_check")intersection(){body();union()for(dy=[0:1:50])translate([0,dy,0])drawer();}
else if(part=="exploded"){
  color([0.76,0.80,0.83,0.32])body();hardware();
  color([0.94,0.55,0.22])translate([0,33,-13])drawer();
  color([0.95,0.7,0.1])translate([0,0,-16])strips();
  color([0.1,0.65,0.7])keys();
} else {
  color([0.76,0.80,0.83,0.4])body();
  color([0.3,0.36,0.42])drawer();hardware();
  color([0.95,0.7,0.1])strips();color([0.1,0.65,0.7])keys();
}

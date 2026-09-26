// NFC jukebox enclosure rB - front-face-down print orientation, millimetres.
// Source: Waveshare ESP32-S3-Touch-LCD-2 dimension drawing.
// RC522 nominal 60x40 PCB; actual thickness/component keepouts need fit check.
// Coordinates: X width, Y front->rear, Z height. Front is Y=0.
// Use: openscad -D 'part="body"' -o body.stl jukebox.scad
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
    // Side service windows accommodate either mirrored USB orientation.
    for(x=[-eps,W-wall-eps])translate([x,0,0])rotate([90,0,90])
      linear_extrude(height=wall+2*eps)
        polygon([[5,22],[18,22],[26,30],[18,38],[5,38]]);
    // Release openings for the two drawer detents, accessible from outside.
    for(x=[-eps,W-wall-eps])translate([x,0,0])rotate([90,0,90])
      linear_extrude(height=wall+2*eps)
        polygon([[40.3,0.7],[44.1,0.7],[45.275,1.875],[44.1,3.05],[40.3,3.05]]);
  }
}

module display_guides(){
  // Retain only glass margins: rear PCB is narrower and stays unobstructed.
  for(right=[false,true]){
    x=right ? glass_x+glass_w+clearance : glass_x-clearance-1;
    box(x,wall-eps,6,1,3.0,H/2+glass_h/2+clearance-6+1.3);
    // Retaining lips grow 1.2 mm over 1.2 mm of print height (45 degrees).
    // They retain 0.9 mm of each glass margin, leaving the rear PCB clear.
    translate([right ? W : 0,0,glass_z+1.05])scale([right ? -1 : 1,1,1])
      linear_extrude(height=glass_h+clearance+1.3-1.05)
        polygon([[4.3,3.5],[5.3,3.5],[6.5,4.7],[6.5,5],[4.3,5]]);
  }
  // Upper stop contacts the outer glass edge, not active LCD.
  box(glass_x-clearance,wall-eps,glass_z+glass_h+clearance,
      glass_w+2*clearance,rail_rear-wall+1.5,1.3);
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

module body(){union(){shell();display_guides();rfid_guides();floor_guides();}}

module tooth_left(){
  // 0.45 mm engagement, 24-mm flexible PLA arm, ramp during insertion.
  translate([0,0,0.95])linear_extrude(height=1.65)
    polygon([[2.35,40.6],[1.55,42.4],[1.55,43.2],[2.35,43.2]]);
}

module drawer(){
  union(){
    difference(){
      union(){
        box(2.3,2.3,0.9,W-4.6,D-2.3,1.9);
        box(2.3,48,0.9,W-4.6,2,57.6);
        // Inner corner fillet substitute: 45-degree triangular gussets.
        for(x=[8,56])translate([x,48,2.7])rotate([90,0,90])
          linear_extrude(height=6)polygon([[0,0],[-5,0],[0,5]]);
      }
      // Free a long cantilever on each side, rooted at Y=20.
      box(3.5,20,0.8,0.8,24.2,2.2);
      box(2.1,43.5,0.8,2.2,0.7,2.2);
      box(W-4.3,20,0.8,0.8,24.2,2.2);
      box(W-4.3,43.5,0.8,2.2,0.7,2.2);
      // Grip opening with a 45-degree roof instead of a 16-mm bridge.
      translate([27,50.1,7])rotate([90,0,0])linear_extrude(height=2.2)
        polygon([[0,0],[16,0],[16,5],[8,13],[0,5]]);
    }
    tooth_left();translate([W,0,0])mirror([1,0,0])tooth_left();
    // Drawer supports display glass vertically, with 0.3 mm end clearance.
    for(x=[glass_x+0.3,glass_x+glass_w-3.3])
      box(x,2.3,2.7,3,1.0,glass_z-clearance-2.7);
    // Rear board stop: only its end face, no pressure on PCB surfaces.
    box(20,rc_y+rc_d+clearance,55.3,30,48-(rc_y+rc_d+clearance)+eps,3.0);
    // Grow the overhang outward from the rear wall at 45 degrees.
    translate([20,48,52.6])rotate([90,0,90])linear_extrude(height=30)
      polygon([[eps,0],[eps,2.72],[-2.7,2.72]]);
  }
}

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
else if(part=="interference")intersection(){body();drawer();}
else if(part=="travel_check")intersection(){
  body();
  union()for(dy=[0:0.5:50])translate([0,dy,0])difference(){
    drawer();
    // The flexible detents intentionally interfere while the drawer slides.
    box(0,39,0,2.3,6,4);box(W-2.3,39,0,2.3,6,4);
  }
}
else if(part=="exploded"){
  color([0.76,0.80,0.83,0.5])body();hardware();
  color([0.94,0.55,0.22])translate([0,35,-10])drawer();
} else {
  color([0.76,0.80,0.83,0.65])body();
  color([0.3,0.36,0.42])drawer();hardware();
}

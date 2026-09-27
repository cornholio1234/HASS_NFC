// Headless ESP32 DevKitC + RC522 enclosure, r0. MIT License.
// Coordinates: X width, Y front to rear, Z up. USB exits at Y=0.
// Dimensions are millimetres. Electronics are illustrative keepout models.
part = "assembly"; // base, cover, plate, assembly, exploded, inside, base_check, cover_check
W=96; D=82; H=46;
wall=2.4; floor_t=2.4; seam=4.4; roof=1.6;
eps=0.02; radius=4;
esp_x=10; esp_y=7; esp_w=28; esp_l=55; esp_z=29.6; pcb_t=1.6;
rc_x=48; rc_y=10; rc_w=40; rc_l=60; rc_z=40.8;
clip_y=[22,60]; clip_w=8; clip_top=25.8;
$fn=48;

module box(x,y,z,w,d,h){translate([x,y,z])cube([w,d,h]);}
module rounded(w,d,h,r){linear_extrude(height=h)offset(r=r)
  translate([r,r])square([w-2*r,d-2*r]);}
module xz_shape(points,y,width){
  translate([0,y+width,0])rotate([90,0,0])linear_extrude(height=width)polygon(points);
}
module side(right=false){translate([right ? W:0,0,0])scale([right ? -1:1,1,1])children();}

module latch(y){
  // Long upright leaf; 0.6 mm nominal deflection against the cover wall.
  // The flat lower shoulder carries lid pull. The upper ramp guides closure.
  box(2.8,y,floor_t-eps,1.6,clip_w,clip_top-floor_t+eps);
  xz_shape([[4.38,2.3],[7,2.3],[4.38,5.5]],y,clip_w);
  xz_shape([[2.82,23.2],[1.8,23.2],[1.8,24.8],[2.82,25.82]],y,clip_w);
}

module base(){difference(){union(){
  rounded(W,D,floor_t,radius);
  difference(){rounded(W,D,seam,radius);
    translate([wall,wall,floor_t])rounded(W-2*wall,D-2*wall,seam,1.6);}
  // This tongue closes the lower part of the open-ended USB cutout.
  box(10.35,0,seam-eps,27.3,wall,25.6-seam+eps);
  // Broad central PCB supports, between the two downward-facing header rows.
  // One 1 mm foam adhesive pad on each support completes the PCB height.
  for(y=[24,44])box(17,y,floor_t-eps,14,10,28.6-floor_t+eps);
  for(right=[false,true])side(right)for(y=clip_y)latch(y);
  // Housing alignment stops. All stop loads terminate in the floor.
  for(x=[4,88])for(y=[4,72])box(x,y,floor_t-eps,4,6,8-floor_t+eps);
}
  // Optional cable-tie slots for the wire bundle, away from both boards.
  for(y=[18,25])box(41,y,-eps,5,2.4,floor_t+2*eps);
}}

module cover_shell(){difference(){
  translate([0,0,seam])rounded(W,D,H-seam,radius);
  translate([wall,wall,seam-eps])rounded(W-2*wall,D-2*wall,H-roof-seam+eps,1.6);
  // Open-ended port cutout: plug body clearance and no bridge in print position.
  box(10,-eps,seam-eps,28,wall+2*eps,40-seam+eps);
  for(right=[false,true])side(right)for(y=clip_y)
    box(-eps,y-0.6,23.0,wall+2*eps,clip_w+1.2,3.2);
  for(x=[20:8:76])box(x,D-wall-eps,10,2,wall+2*eps,12);
  // Shallow card target. The roof remains at least 1.3 mm thick.
  translate([68,40,H-0.3])linear_extrude(height=0.4){
    difference(){circle(r=13);circle(r=12.3);}
    text("NFC",size=6,halign="center",valign="center",font="Liberation Sans:style=Bold");
  }
}}
module cover(){union(){
  cover_shell();
  // Shallow alignment marks on the inside roof, outside the RC522 corners.
  for(x=[rc_x-.6,rc_x+rc_w-7.4])for(y=[rc_y-.6,rc_y+rc_l-7.4]){
    box(x,y==rc_y-.6 ? y : y+7.2,H-roof-.4,8,.8,.4+eps);
    box(x==rc_x-.6 ? x : x+7.2,y,H-roof-.4,.8,8,.4+eps);
  }
}}

module foam(){
  color([0.84,0.75,0.48])for(y=[24,44])box(17,y,28.6,14,10,1);
  // Four 6 x 6 x 2 mm pads on the flat antenna face of the RC522.
  color([0.84,0.75,0.48])for(x=[rc_x+2,rc_x+rc_w-8])for(y=[rc_y+2,rc_y+rc_l-8])
    box(x,y,rc_z+pcb_t,6,6,2);
}
module esp(){
  color([0.1,0.28,0.22])box(esp_x,esp_y,esp_z,esp_w,esp_l,pcb_t);
  color([0.65,0.67,0.69])box(15,35,esp_z+pcb_t,18,20,3.2);
  color([0.14,0.16,0.19])for(x=[10,35.4])box(x,8,esp_z-2.5,2.54,48.3,2.5);
  color([0.7,0.57,0.25])for(x=[11.27,36.67])for(y=[9.3:2.54:55.1])
    box(x-.32,y-.32,esp_z-8,.64,.64,8);
  color([0.65,0.67,0.69])box(19,5,esp_z+pcb_t,10,7,3.2);
  color([0.2,0.2,0.23])for(x=[12,30])box(x,9,esp_z+pcb_t,5,4,3);
}
module rfid(){
  color([0.06,0.37,0.65])box(rc_x,rc_y,rc_z,rc_w,rc_l,pcb_t);
  color([0.2,0.2,0.23])box(60,22,rc_z-3,12,12,3);
  color([0.17,0.18,0.2])box(57,11,rc_z-12,22,3,12);
  color([0.84,0.62,0.18])translate([68,47,rc_z+pcb_t])linear_extrude(height=.05)
    difference(){square([34,39],center=true);square([31,36],center=true);}
}
module cables(){
  // Nominal mated header/socket and wire-bend envelopes, not solid parts.
  color([0.8,0.32,0.12,.25])for(x=[9,34])box(x,8,6,5,49,esp_z-6);
  color([0.8,0.32,0.12,.25])box(54,8,13,30,12,rc_z-13);
}
module electronics(){esp();rfid();foam();}
module cover_print(){translate([0,D,H])rotate([180,0,0])cover();}

if(part=="base" || part=="base_check")base();
else if(part=="cover")cover_print();
else if(part=="cover_check")cover();
else if(part=="plate"){
  color([.18,.23,.28])base();translate([W+8,0,0])color([.72,.77,.8])cover_print();
}else if(part=="inside"){
  color([.18,.23,.28])base();electronics();cables();
}else if(part=="exploded"){
  color([.18,.23,.28])render()base();esp();
  color([.84,.75,.48])for(y=[24,44])box(17,y,28.6,14,10,1);
  // Both halves open on the table, with electronics in their installed positions.
  translate([W+8,D,H])rotate([180,0,0]){color([.72,.77,.8])render()cover();rfid();
    color([.84,.75,.48])for(x=[50,80])for(y=[12,62])box(x,y,42.4,6,6,2);}
}else{
  color([.18,.23,.28])render()base();color([.72,.77,.8])render()cover();
}

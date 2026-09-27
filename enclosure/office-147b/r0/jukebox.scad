// Office NFC jukebox, Waveshare ESP32-S3-LCD-1.47B-M + RC522.
// Units mm. X left/right, Y front/rear, Z up. USB faces right.
// Board footprint 36.37 x 20.32 from manufacturer drawing.
// Module thickness and connector envelopes are provisional, not measured.
part="assembly";
module_depth=7; // Front of display to rear PCB, excluding pins/connectors.
key_fit=0;
$fn=32;
W=70; D=50; H=40; wall=2; eps=.02;
mw=36.37; mh=20.32; mx=(W-mw)/2; mz=6;
frame_x=mx-2; frame_z=5.8; frame_w=mw+4; frame_h=22.52;
rc_x=5; rc_y=5; rc_z=36.4;
module box(x,y,z,dx,dy,dz){translate([x,y,z])cube([dx,dy,dz]);}

module usb_clearance(){
  // A recessed USB socket: opening admits the plug housing, not only its tip.
  translate([mx+mw-3,0,0])rotate([90,0,90])linear_extrude(height=W-mx-mw+3+eps)
    polygon([[3,10],[19,10],[24,15],[24,18],[19,23],[3,23]]);
}
module key_holes(){
  for(right=[false,true])translate([right?W:0,0,0])scale([right?-1:1,1,1])
    for(z=[7,25]){
      box(-eps,41.4,z-1.6,9.4,5.2,3.2);
      box(-eps,39.6,z-1.75,1.12,8.8,3.5);
    }
}
module body(){difference(){
  union(){
    difference(){
      linear_extrude(height=H)polygon([[2,0],[W-2,0],[W,2],[W,D-2],
        [W-2,D],[2,D],[0,D-2],[0,2]]);
      box(2,2,-eps,W-4,D,H-1.2+eps);
      // Provisional centered window; 0.6-mm bezel overlap on each board edge.
      box(mx+.6,-eps,mz+.6,mw-1.2,2+2*eps,mh-1.2);
    }
    // Continuous side cheeks support the board and the removable pressure frame.
    for(right=[false,true])translate([right?W:0,0,0])scale([right?-1:1,1,1]){
      box(2-eps,2-eps,4,frame_x-.3-2+eps,26.54,24.92);
      // Rear stop: 1.3 mm local lip, followed by a supporting 45-degree ramp.
      translate([0,0,frame_z])linear_extrude(height=frame_h+.3)
        polygon([[1.98,28.5],[frame_x+1,28.5],[frame_x+1,29.8],
                 [frame_x-.3,31.1],[1.98,31.1]]);
      // Board edge guide grows from the front bezel; outside the board footprint.
      box(frame_x-.35,1.98,mz,1.99,2.02,mh+.3);
    }
    // Broad top stop, supported by the front wall.
    box(mx-.32,1.98,mz+mh+.25,mw+.64,2.02,2);
    // Floor tracks.
    for(x=[1.98,66]){
      box(x,1.98,0,2.02,44.92,.6);
      box(x,1.98,3.1,2.02,44.92,1);
    }
    // RC522 rails: 1.6-mm PCB, 0.8-mm clearance to the 1.2-mm roof.
    for(right=[false,true])translate([right?W:0,0,0])scale([right?-1:1,1,1]){
      box(1.98,4.7,35.2,2.72,42.2,3.62);
      box(1.98,4.7,35.2,4.22,42.2,1.2);
    }
    box(1.98,1.98,35.2,66.04,2.72,3.62);
  }
  usb_clearance();
  key_holes();
}}
module retainer(){
  // One removable frame; its rear face seats against the body's rear stops.
  // Four columns contact only corner areas, leaving headers and USB clear.
  union(){
    difference(){
      box(frame_x,25.5,frame_z,frame_w,3,frame_h);
      box(frame_x+6,25.4,frame_z+4,frame_w-12,3.2,frame_h-8);
    }
    for(x=[mx+.3,mx+mw-3.3])for(z=[mz+.2,mz+mh-3.2])
      box(x,2+module_depth,z,3,25.52-(2+module_depth),3);
  }
}
module drawer(){difference(){
  union(){
    box(2.3,2.3,.9,W-4.6,D-2.3,1.9);
    box(2.3,47.2,.9,W-4.6,2.8,37.6);
    // Four key seats below the RC522 component clearance zone.
    for(x=[4.3,W-8.5])box(x,39,2.7,4.2,8.22,24.8);
    // Full-width cradle supports board and retainer from below.
    box(frame_x+.1,2.3,2.7,frame_w-.2,26.2,3.05);
    // RFID end stop plus self-supporting triangular brace.
    box(20,45.3,35.3,30,1.92,3);
    translate([20,47.2,33.4])rotate([90,0,90])linear_extrude(height=30)
      polygon([[eps,0],[eps,1.92],[-1.9,1.92]]);
  }
  key_holes();
  translate([27,50.1,7])rotate([90,0,0])linear_extrude(height=3)
    polygon([[0,0],[16,0],[16,4],[8,12],[0,4]]);
}}
module key(){linear_extrude(height=2.9)polygon([[0,-4],[1,-4],
  [1,-2.625-key_fit/2],[3,-2.6-key_fit/2],[8,-2.3],[8,2.3],
  [3,2.6+key_fit/2],[1,2.625+key_fit/2],[1,4],[0,4]]);}
module keys(){for(right=[false,true])translate([right?W:0,0,0])scale([right?-1:1,1,1])
  for(z=[7,25])translate([0,44,z-1.45])key();}
module hardware(){
  color([.1,.18,.22])box(mx,2,mz,mw,module_depth,mh);
  color([.08,.65,.64])box(mx+1.96,1.97,mz+1.43,32.45,.02,17.46);
  color([.1,.35,.65])box(5,5,rc_z,60,40,1.6);
  // Conservative illustrative connector/wire envelopes, not measured components.
  color([.5,.5,.5,.3])for(z=[mz,mz+mh-3])box(mx+4,2+module_depth,z,23,15,3);
}
module body_print(){translate([0,H,0])rotate([90,0,0])body();}
module retainer_print(){translate([-frame_x,-frame_z,28.5])rotate([-90,0,0])retainer();}
module keys_print(){for(i=[0:3])translate([i*11,4,0])key();}
if(part=="body")body_print();
else if(part=="drawer")translate([0,0,-.9])drawer();
else if(part=="retainer")retainer_print();
else if(part=="keys")keys_print();
else if(part=="body_assembly")body();
else if(part=="drawer_assembly")drawer();
else if(part=="retainer_assembly")retainer();
else if(part=="plate"){
  body_print();translate([80,0,-.9])drawer();
  translate([0,55,0])retainer_print();translate([80,55,0])keys_print();
}else if(part=="exploded"){
  color([.76,.8,.83,.35])body();hardware();
  color([.95,.65,.1])translate([0,8,-8])retainer();
  color([.95,.5,.2])translate([0,35,-12])drawer();
  color([.1,.65,.7])keys();
}else{
  color([.76,.8,.83,.4])body();hardware();
  color([.95,.65,.1])retainer();color([.3,.36,.42])drawer();
  color([.1,.65,.7])keys();
}

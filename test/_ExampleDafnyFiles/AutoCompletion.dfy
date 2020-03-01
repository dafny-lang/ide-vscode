class C {
   constructor () {
      var c := 1;
   }

   method m() {
      var b := 1+2;
      var c := b+1; 
   }
  }

method Main() {
   var a := 1+2;
   print "a is ";
   print a; 
   var acc2 := new C();
   var acc3 := new C();
   acc3.m(); 
   acc3.m(); 
   acc2.m(); 
}


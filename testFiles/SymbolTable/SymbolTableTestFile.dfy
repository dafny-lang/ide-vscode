method MultipleReturns(inp1: int, inp2: int) 
   returns (more: int, less: int)
   requires inp2 > 0 
   ensures less < inp1 < more
{
   more := inp1 + inp2;   
   less := inp1 - inp2;
} 

class ClassA {
   var var1: int;  
   var var2: int;

   constructor (ctorarg: int) {   
      var1 := ctorarg;  
   }
   method myMethod(argument: int) returns (r1: int, r2: int)
   modifies this {
 
       //Basics
      var anotherVar := 2;
      anotherVar := argument;   
      anotherVar := var1;
      anotherVar := myMethod2();

      var anotherThing := new AnotherClass();

        //Multiple ASsignment
      var m1: int, m2: int := 5, 2; 
      var m3, m4 := var1, var2; 
      m1, m2 := m3, m4;
      m4, m3 := m3, m4;

      //Shadowing
      var var1 := 10;
      var1 := 11;               
      this.var1 := 12;
      var1 := this.var1;
      
      //if
      if (var1 == 12) {
          var1:= 14;
      }

      //while
      while (var1 > 1)
      decreases var1 {
          var1 := var1 - 1;
      }

        //gäbe noch match, print, uvm, siehe spec.
  
      //Blockstatement  
      {
         var1 := 65;        //inherited scope from above
         var var1 := 2;     //redefined in blockstatement
         print var1, "\n";  //2
      }
      print var1; //65


      return var1, var2;
   } 

   method myMethod2() returns (a: int)
   modifies this {
      return 222;
   }
}

class AnotherClass {
   constructor() {}
}

predicate isEven(a: int) {
   a % 2 == 0 
}

method Main() {
   var myNumber := 1+2;
   var myClass := new ClassA(1);
   var a, b := myClass.myMethod(1);
   a := myClass.myMethod2();
   
}

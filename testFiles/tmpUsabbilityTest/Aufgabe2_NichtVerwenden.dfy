include "Aufgabe2_Verwenden.dfy"

method Main() {
   var myNumber := 1+2;
   var classA := new ClassA();
   classA.myMethod();
   var classB1 := new ClassB();
   var classB2 := new ClassB();
   classB1.myMethod();
   classB2.myMethod();
   classB2.myMethod();

   var more;
   var less;
   more, less := MultipleReturns(1,2);
   
   var abc := new ClassC();
   abc.ABC := 1;
}
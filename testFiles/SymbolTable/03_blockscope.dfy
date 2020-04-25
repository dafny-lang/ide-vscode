class MyClass {
    var field: int;
    constructor () { }
    method aMethod() modifies this {
        field := 1; 
        print field;  //1

        var field := 2;
        print field;  //2
        print this.field;  //1 

        { 
            print field;  //2
            print this.field;  //1

            var field := 3;
            print field; //3 
            print this.field; //1
        }
        
        print field;  //2
        print this.field;  //1 
    }

}

/*
method Main() {  
    var a := new MyClass();
    a.aMethod();
} 
*/
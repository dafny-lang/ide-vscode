class BankAccountUnsafe {
	var balance: int;
	
  constructor() modifies this {
    balance := 10;
  }

	method withdraw(amount: int) 
    ensures balance >= 0
  modifies this {
		balance := balance - amount;
	}
}

method test() {
  var a := new BankAccountUnsafe();
  a.withdraw(-11);

}
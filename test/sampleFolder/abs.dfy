method abs(x:int, y:int) returns (z:int)
ensures x == z || y == z;
ensures x <= z && y <= z; {  
  if x > y {
    return x;
  } else {
    return y;
  }
}

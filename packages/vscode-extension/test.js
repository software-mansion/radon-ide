const promise1 = new Promise((resolve, reject) => {
    setTimeout(()=>{
        console.log("promise1");
        resolve("one");
    }, 500);
  });
  
  const promise2 = new Promise((resolve, reject) => {
    setTimeout(()=>{
        console.log("promise2");
        resolve("two");
    }, 100);
  });
  
  Promise.race([promise1, promise2]).then((value) => {
    console.log(value);
    // Both resolve, but promise2 is faster
  });
  // Expected output: "two"
async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/foo');
    console.log('foo status:', res.status);
    console.log('foo text:', await res.text());
  } catch (err) {
    console.error('foo err:', err.message);
  }
}
test();

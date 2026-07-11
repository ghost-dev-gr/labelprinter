// Local Network Access stub
window.lna = {
    detectLna: function() {
        return Promise.resolve(null);
    }
};
console.log("LNA stub initialized");

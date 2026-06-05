const mongoose = require('mongoose');

mongoose.connect("mongodb+srv://edward:Edward%402025@cluster0.zglfrnq.mongodb.net/?appName=Cluster0")
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));
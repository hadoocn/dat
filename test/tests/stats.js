var fs = require('fs')
var path = require('path')
var request = require('request').defaults({json: true})
var parallel = require('run-parallel')
var concat = require('concat-stream')

module.exports.rest = function(test, common) {
  test('collects rest stats', function(t) {
    if (common.rpc) return t.end()
    common.getDat(t, function(dat, cleanup) {
      var statsStream = dat.createStatsStream()
      statsStream.pipe(concat(function(stats) {
        var totals = sumStats(stats)
        t.ok(totals.http.read > 100, 'read some')
        t.ok(totals.http.read < 2000, 'not too much')
        t.ok(totals.http.written > 100, 'wrote some')
        t.ok(totals.http.written < 2000, 'not too much')
        cleanup()
      }))

      var body = {foo: 'bar'}
      request({method: 'POST', uri: 'http://localhost:' + dat.defaultPort + '/api/rows', json: body }, function(err, res, stored) {
        if (err) throw err
        request({uri: 'http://localhost:' + dat.defaultPort + '/api/json', json: true}, function(err, res, json) {
          if (err) throw err
          setTimeout(function() {
            statsStream.destroy()
          }, 1500)
        })
      })

    })
  })
}

module.exports.level = function(test, common) {
  test('collects level stats', function(t) {
    if (common.rpc) return t.end()
    common.getDat(t, function(dat, cleanup) {
      var statsStream = dat.createStatsStream()
      statsStream.pipe(concat(function(stats) {
        var totals = sumStats(stats)
        t.equal(totals.level.read, 50)
        t.equal(totals.level.written, 50)
        cleanup()
      }))

      var ws = dat.createWriteStream({ json: true, quiet: true })

      ws.on('end', function() {
    
        var cat = dat.createReadStream()
    
        cat.pipe(concat(function(data) {
          setTimeout(function() {
            statsStream.destroy()
          }, 1500)
        }))
      })
    
      ws.write(new Buffer(JSON.stringify({"batman": "bruce wayne"})))
      ws.end()
    })
  })
}

module.exports.blobs = function(test, common) {
  test('collects blob stats', function(t) {
    if (common.rpc) return t.end()
    common.getDat(t, function(dat, cleanup) {
      var statsStream = dat.createStatsStream().pipe(concat(function(stats) {
        var totals = sumStats(stats)
        t.ok(totals.blobs.read > 100, 'read some')
        t.ok(totals.blobs.read < 10000, 'not too much')
        t.ok(totals.blobs.written > 100, 'wrote some')
        t.ok(totals.blobs.written < 10000, 'not too much')
        cleanup()
      }))
      
      var ws = dat.createBlobWriteStream('stats.js', function(err, doc) {
        var rs = dat.createBlobReadStream(doc.key, 'stats.js')
        
        rs.pipe(concat(function(file) {
          setTimeout(function() {
            statsStream.end()
          }, 1500)
        }))
        
      })
      
      fs.createReadStream(path.join(__dirname, 'stats.js')).pipe(ws)
    })
  })
}

module.exports.all = function (test, common) {
  module.exports.rest(test, common)
  module.exports.level(test, common)
  module.exports.blobs(test, common)
}

function sumStats(stats) {
  var total = {
    http: {
      written: 0,
      read: 0
    },
    level: {
      written: 0,
      read: 0,
      get: 0,
      put: 0,
      del: 0
    },
    blobs: {
      written: 0,
      read: 0
    }
  }
  
  stats.map(function(stat) {
    total.http.written += stat.http.written
    total.level.written += stat.level.written
    total.blobs.written += stat.blobs.written
    total.http.read += stat.http.read
    total.level.read += stat.level.read
    total.blobs.read += stat.level.read
    total.level.get += stat.level.get
    total.level.put += stat.level.put
    total.level.del += stat.level.del
  })

  return total
}

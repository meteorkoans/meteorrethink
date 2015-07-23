if (Meteor.isServer) {
  this.Rethink = new RethinkDB();
  if (!Rethink.tableExists('msgs')) {
    console.log("Creating 'msgs' table...");
    Rethink.run(r.tableCreate('msgs'));
    console.log("...done");
  }
  if (!Rethink.hasIndex('createdAt', r.table('msgs'))) {
    Rethink.run(r.table('msgs').indexCreate('createdAt'));
  }
  DB.publish({
    name: 'msgs',
    ms: 10000,
    query: function() {
      return Rethink.fetch(r.table('msgs').orderBy({
        index: r.desc('createdAt')
      }));
    },
    depends: function() {
      return ['msgs'];
    }
  });
}

if (Meteor.isClient) {
  this.msgs = DB.createSubscription('msgs');
  Template.main.onRendered(function() {
    return this.autorun(function() {
      return msgs.start();
    });
  });
  Template.main.helpers({
    msgs: function() {
      return msgs;
    }
  });
  Template.main.events({
    'click button': function(e, t) {
      var id, input;
      input = t.find('input');
      id = DB.newId();
      Meteor.call('newMsg', id, input.value, function(err, result) {
        if (err) {
          return msgs.handleUndo(id);
        }
      });
      return input.value = '';
    }
  });
}

Meteor.methods({
  newMsg: function(id, text) {
    var fields, msg, ref;
    check(id, String);
    check(text, String);
    msg = {
      _id: id,
      text: text,
      createdAt: Date.now()
    };
    if (Meteor.isServer) {
      Rethink.run(r.table('msgs').insert(msg));
      return DB.triggerDeps('msgs');
    } else {
      fields = R.pipe(R.assoc('unverified', true), R.omit(['_id']))(msg);
      msgs.addedBefore(id, fields, ((ref = msgs.docs[0]) != null ? ref._id : void 0) || null);
      return msgs.addUndo(id, function() {
        return msgs.removed(id);
      });
    }
  }
});

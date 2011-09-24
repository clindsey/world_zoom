(function(){
  var SEED = 20110924;
  jQuery(document).ready(function(){
    var node = bind_to_elem('#canvas'),
        scene = Scene(node.context,node.width,node.height);
    MainScene(scene);
  });
  var MainScene = function(scene){
    var zone_manager = ZoneManager(SEED,10,10,3),
        viewport = Viewport(scene,80,80,14,zone_manager);
    var render_fn = function(){
      viewport.render();
      requestAnimationFrame(function(){
        render_fn();
      });
    };
    render_fn();
    jQuery(document).keydown(function(e){
      if( e.keyCode === 37 ||
          e.keyCode === 38 ||
          e.keyCode === 39 ||
          e.keyCode === 40 ||
          e.keyCode === 88 ||
          e.keyCode === 90){
        var vx = 0,
            vy = 0,
            speed = 1;
        if(e.keyCode === 37){
          vx -= speed;
        }
        if(e.keyCode === 38){
          vy -= speed;
        }
        if(e.keyCode === 39){
          vx += speed;
        }
        if(e.keyCode === 40){
          vy += speed;
        }
        if(e.keyCode === 88){
          viewport.zoom_in();
        }
        if(e.keyCode === 90){
          viewport.zoom_out();
        }
        viewport.move_by(vx,vy);
      }
    });
  };
  var Viewport = function(scene,width,height,tile_size,zone_manager){
    var self = {},
        map = [],
        cursor_x = 0,
        cursor_y = 0,
        old_cursor_x,
        old_cursor_y,
        bg = Background(scene.width,scene.height,'#DAE8F2');
    self.move_by = function(vx,vy){
      cursor_x = clamp(cursor_x + vx,zone_manager.world_tile_width);
      cursor_y = clamp(cursor_y + vy,zone_manager.world_tile_height);
    };
    self.zoom_in = function(){
      zone_manager.zoom_in(function(dx,dy){
        cursor_x += dx;
        cursor_y += dy;
      });
    };
    self.zoom_out = function(){
      zone_manager.zoom_out(function(dx,dy){
        cursor_x -= dx;
        cursor_y -= dy;
      });
    };
    self.render = function(){
      if((old_cursor_x === cursor_x && old_cursor_y === cursor_y) && zone_manager.dirty === false){
        return;
      }
      scene.clear();
      scene.draw(bg);
      var tile,
          start_x = Math.floor(width / 2),
          start_y = Math.floor(height / 2),
          factor,
          f,
          h;
      for(var y = 0, x; y < height; y += 1){
        if(map[y] === undefined){
          map[y] = [];
        }
        for(x = 0; x < width; x += 1){
          (function(x,y,start_x,start_y,cursor_x,cursor_y){
            zone_manager.get_tile(x + cursor_x - start_x,y + cursor_y - start_y,function(tile){
              var h = tile.height,
                  f = tile.color;
              if(map[y][x] === undefined || map[y][x].height !== tile.height){
                var tile_x = (x - y) * (tile_size / 2) + (scene.width / 2) - (tile_size / 2),
                    tile_y = (x + y) * (tile_size / 4) + (scene.height / 2) - (height * tile_size / 4);
                map[y][x] = Tile(tile_x,tile_y,tile_size,h,{'background-color':f});
              }else{
                map[y][x].style['background-color'] = f;
              }
              scene.draw(map[y][x]);
            });
          })(x,y,start_x,start_y,cursor_x,cursor_y);
        }
      }
      old_cursor_x = cursor_x;
      old_cursor_y = cursor_y;
      zone_manager.dirty = false;
    };
    return self;
  };
  var ZoneManager = function(seed,w,h,zoom_factor){
    var self = {},
        zones,
        world_tile_width,
        world_tile_height,
        zone_width,
        zone_height,
        tile_cache;
    self.world_width = w;
    self.world_height = h;
    self.dirty = false;
    var init = function(zf){
      zone_width = (zf * 1) * 2;
      zone_height = (zf * 1) * 2;
      self.world_tile_width = zone_width * self.world_width;
      self.world_tile_height = zone_height * self.world_height;
      tile_cache = {};
      zones = {};
    };
    init(zoom_factor);
    self.zoom_in = function(callback){
      if(zoom_factor < 100){
        zoom_factor += 1;
        self.dirty = true;
        init(zoom_factor);
        callback(self.world_tile_width * (1 / zoom_factor),self.world_tile_height * (1 / zoom_factor));
      }
    };
    self.zoom_out = function(callback){
      if(zoom_factor > 3){
        zoom_factor -= 1;
        self.dirty = true;
        init(zoom_factor);
        callback(self.world_tile_width * (1 / zoom_factor),self.world_tile_height * (1 / zoom_factor));
      }
    };
    self.get_tile = function(x,y,callback){
      var clamped_x = clamp(x,self.world_tile_width),
          clamped_y = clamp(y,self.world_tile_height);
      if(tile_cache[clamped_x + ',' + clamped_y] !== undefined){
        callback(tile_cache[clamped_x + ',' + clamped_y]);
      }else{
        var zone_x = Math.floor(clamped_x / zone_width),
            zone_y = Math.floor(clamped_y / zone_height),
            local_x = clamped_x % zone_width,
            local_y = clamped_y % zone_height,
            zone;
        if(zones[zone_x + ',' + zone_y] === undefined){
          var z = Zone(seed,zone_x,zone_y,zone_width,zone_height,self.world_width,self.world_height);
          zones[zone_x + ',' + zone_y] = z;
        }
        zone = zones[zone_x + ',' + zone_y];
        if(zone.map[local_y] && zone.map[local_y][local_x]){
          tile_cache[x + ',' + y] = zone.map[local_y][local_x];
          callback(zone.map[local_y][local_x]);
        }
      }
    };
    return self;
  };
  var Zone = function(seed,x,y,zone_width,zone_height,world_width,world_height){
    var self = {},
        nw,
        ne,
        sw,
        se,
        ts_width = world_width;
    nw = ~~(Alea((y * ts_width + x) + seed)() * 255);
    if(x + 1 >= world_width){
      ne = ~~(Alea((y * ts_width + (0)) + seed)() * 255);
    }else{
      ne = ~~(Alea((y * ts_width + (x + 1)) + seed)() * 255);
    }
    if(y + 1 >= world_height){
      sw = ~~(Alea(((0) * ts_width + x) + seed)() * 255);
    }else{
      sw = ~~(Alea(((y + 1) * ts_width + x) + seed)() * 255);
    }
    if(y + 1 >= world_height){
      if(x + 1 >= world_width){
        se = ~~(Alea(((0) * ts_width + (0)) + seed)() * 255);
      }else{
        se = ~~(Alea(((0) * ts_width + (x + 1)) + seed)() * 255);
      }
    }else{
      if(x + 1 >= world_width){
        se = ~~(Alea(((y + 1) * ts_width + (0)) + seed)() * 255);
      }else{
        se = ~~(Alea(((y + 1) * ts_width + (x + 1)) + seed)() * 255);
      }
    }
    self.map = lerp(zone_width,zone_height,nw,ne,sw,se);
    return self;
  };
  var Tile = function(x,y,size,h,style){
    var height = 8;
    var self = DisplayObject(x,y,size,size / 2 + height - h,style);
    self.add_vertex(size / 2,0 - height - h);
    self.add_vertex(size,size / 4 - height - h);
    self.add_vertex(size,size / 4 - h);
    self.add_vertex(size / 2,size / 2 - h);
    self.add_vertex(0,size / 4 - h);
    self.add_vertex(0,size / 4 - height - h);
    return self;
  };
  var Background = function(width,height,fill){
    var self = DisplayObject.Rectangle(0,0,width,height,{'background-color':fill});
    return self;
  };
  var Scene = function(context,width,height){
    var self = {};
    self.width = width;
    self.height = height;
    self.draw = function(display_object){
      draw_display_object(display_object);
    };
    self.clear = function(){
      context.canvas.width = context.canvas.width;
    };
    var draw_display_object = function(displayable){
      if( displayable.x > self.width + displayable.width ||
          displayable.x + displayable.width < 0 ||
          displayable.y > self.height + 20 ||
          displayable.y + displayable.height < 0){
        return;
      }
      var j, jl,
          vertex;
      context.save();
      context.translate(displayable.x,displayable.y);
      if(displayable.style['border-width'] > 0){
        context.strokeStyle = displayable.style['border-color'];
        context.lineWidth = displayable.style['border-width'];
      }
      context.fillStyle = displayable.style['background-color'];
      if(displayable.vertices.length > 0){
        context.beginPath();
        for(j = 0, jl = displayable.vertices.length; j < jl; j += 1){
          vertex = displayable.vertices[j];
          if(j === 0){
            context.moveTo(vertex.x,vertex.y);
          }else{
            context.lineTo(vertex.x,vertex.y);
          }
        }
        context.fill();
        if(displayable.style['border-width'] > 0){
          context.stroke();
        }
      }
      context.restore();
    };
    return self;
  };
  var DisplayObject = function(x,y,width,height,style){
    var self = {};
    self.x = x;
    self.y = y;
    self.width = width;
    self.height = height;
    self.vertices = [];
    self.style = {  'background-color':(style['background-color'] || 'rgba(0,0,0,0)'),
                    'border-width':(style['border-width'] || 0),
                    'border-color':(style['border-color'] || 'rgba(0,0,0,0)')};
    self.add_vertex = function(x,y){
      self.vertices.push({'x':x,'y':y});
    };
    return self;
  };
  DisplayObject.Rectangle = function(x,y,width,height,style){
    var self = DisplayObject(x,y,width,height,style);
    self.add_vertex(0,0);
    self.add_vertex(self.width,0);
    self.add_vertex(self.width,self.height);
    self.add_vertex(0,self.height);
    return self;
  };
  var clamp = function(index,size){
    return (index + size) % size;
  };
  var tween = function(a,b,f){
    return a + f * (b - a);
  };
  var lerp = function(width,height,nw,ne,sw,se){
    var map = [],
        xf,
        yf,
        t,
        b,
        v,
        x_lookup = [],
        height_step = 6;
    for(var y = 0, x; y < height; y += 1){
      map[y] = [];
      yf = y / height;
      for(x = 0; x < width; x += 1){
        if(x_lookup[x]){
          xf = x_lookup[x];
        }else{
          xf = x_lookup[x] = x / width;
        }
        t = nw + xf * (ne - nw);
        b = sw + xf * (se - sw);
        v = t + yf * (b - t);
        var factor = (~~v - 128) / 128,
            h,
            cr,
            cg,
            cb,
            p;
        if(factor <= -0.25){ // deep water
          cb = ~~tween(255,128,(Math.abs(factor) - 0.25) / 0.75);
          f = 'rgba(0,0,' + cb + ',1)';
          h = height_step;
        }else if(factor > -0.25 && factor <= 0){ // shallow water
          cg = ~~tween(128,0,(Math.abs(factor) / 0.25));
          f = 'rgba(0,' + cg + ',255,1)';
          h = height_step;
        }else if(factor > 0 && factor <= 0.0625){ // shore
          p = factor / 0.0625;
          cr = ~~tween(0,240,p);
          cg = ~~tween(128,240,p);
          cb = ~~tween(255,64,p);
          h = height_step;
          f = 'rgba(' + cr + ',' + cg + ',' + cb + ',1)';
        }else if(factor > 0.0625 && factor <= 0.15){ // sand
          p = (factor - 0.0625) / 0.0875;
          cr = ~~tween(240,32,p);
          cg = ~~tween(240,160,p);
          cb = ~~tween(64,0,p);
          f = 'rgba(' + cr + ',' + cg + ',' + cb + ',1)';
          h = height_step;
        }else if(factor > 0.15 && factor <= 0.6){ // grass
          p = (factor - 0.2) / 0.5;
          cr = ~~tween(32,32,p);
          cg = ~~tween(160,160,p);
          cb = 0;
          f = 'rgba(' + cr + ',' + cg + ',' + cb + ',1)';
          h = height_step * 2;
        }else if(factor > 0.6 && factor <= 0.7){ // grass
          p = (factor - 0.6) / 0.1;
          cr = ~~tween(32,224,p);
          cg = ~~tween(160,224,p);
          cb = 0;
          f = 'rgba(' + cr + ',' + cg + ',' + cb + ',1)';
          h = height_step * 2;
        }else if(factor > 0.7 && factor <= 0.8){ // dirt
          p = (factor - 0.7) / 0.1;
          cr = ~~tween(224,128,p);
          //cg = ~~tween(224,128,p);
          cb = ~~tween(0,128,p);
          f = 'rgba(' + cr + ',' + cr + ',' + cb + ',1)';
          h = height_step * 3;
        }else if(factor > 0.8 && factor <= 0.92){ // rock
          p = (factor - 0.8) / 0.12;
          cr = ~~tween(128,255,p);
          //cg = ~~tween(128,255,p);
          //cb = ~~tween(128,255,p);
          f = 'rgba(' + cr + ',' + cr + ',' + cr + ',1)';
          h = height_step * 4;
        }else{ // snow
          f = 'rgba(255,255,255,1)';
          h = height_step * 5;
        }
        /*
        h = ~~(factor * 20);
        if(h < 4){
          h = 4;
        }
        */
        //h = 4;
        map[y][x] = {'height':h,'color':f};
      }
    }
    return map;
  };
  var bind_to_elem = function(elem_selector){
    var bind_elem = jQuery(elem_selector),
        canvas_elem = document.createElement('canvas'),
        context = canvas_elem.getContext('2d');
    canvas_elem.width = bind_elem.width();
    canvas_elem.height = bind_elem.height();
    bind_elem.empty();
    bind_elem.append(canvas_elem);
    return {  'context':context,
              'width':canvas_elem.width,
              'height':canvas_elem.height};
  };
  /**
   * Provides requestAnimationFrame in a cross browser way.
   * @author paulirish / http://paulirish.com/
   */
  if ( !window.requestAnimationFrame ) {
    window.requestAnimationFrame = ( function() {
      return  window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame ||
              window.oRequestAnimationFrame ||
              window.msRequestAnimationFrame ||
              function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {
                window.setTimeout( callback, 1000 / 60 );
              };
    } )();
  }
})();
